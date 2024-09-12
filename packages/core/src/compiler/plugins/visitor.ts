import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { visit, CONTINUE, SKIP } from 'unist-util-visit'
import { walk } from 'estree-walker'
import { camelCase, kebabCase } from 'change-case'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { WorkflowInputSchema } from '../../runtime'

import type { Program } from 'estree'
import type { Node } from 'estree-jsx'
import type { Root } from 'mdast'
import type { Transformer } from 'unified'
import type { VFile } from 'vfile'
import type { CompileOptions } from '../compiler'
import type { Action } from '../../index'

/**
 * A unified transformer that traverses MDX AST, and parses YAML frontmatter,
 * validates input schemas, and transforms MDX elements into custom node types
 * for further processing.
 */
export function workflowVisitor(options: CompileOptions): Transformer<Root, Root> {
  return (tree, file) => {
    visit(tree, (node, i, parent) => {
      // root node, just continue
      if (typeof i === 'undefined') return CONTINUE

      // yaml node, parse and validate frontmatter
      if (is(node, 'yaml')) {
        try {
          node.data = parseYaml(node.value)
          WorkflowInputSchema.parse((node.data as any).inputs || {})
        } catch(e: any) {
          if (e instanceof z.ZodError) {
            for (const issue of e.issues) {
              file.fail(
                `Invalid input schema at \`${issue.path.join('.')}\`. ${issue.message}`,
                node,
                'workflow-parse:invalid-input-schema'
              )
            }
          } else {
            file.fail(e as Error, node, 'workflow-parse:yaml-error')
          }
        }
        return SKIP
      }

      // blockquotes, treat as comments, remove and and ignore
      if (is(node, 'blockquote')) {
        parent!.children.splice(i, 1)
        return [SKIP, i]
      }

      if (is(node, 'mdxJsxFlowElement')) {
        const { children, position } = node

        const name = kebabCase(node.name || '')
        const attributes: Record<string, any> = {}
        let action: Action | undefined

        for (const attr of node.attributes) {
          if (attr.type === 'mdxJsxAttribute') {
            const propName = camelCase(attr.name)

            if (is(attr.value, 'mdxJsxAttributeValueExpression')) {
              validateEstree(attr.value.data?.estree as Program, file)

              attributes[propName] = u('expression', {
                data: attr.value.data,
                value: attr.value.value,
                position: node.position,
              })
            } else {
              attributes[propName] = attr.value
            }
          } else {
            file.message(
              'Unsupported attribute syntax in Action. Use key-value pairs only.',
              attr,
              'workflow-parse:unsupported-attribute-syntax'
            )
          }
        }

        if (options.runtime && options.runtime.hasAction(name)) {
          action = options.runtime.useAction(name)
        }

        if (!name || (options.runtime && !action)) {
          file.fail(
            `Unknown action '${name || 'unnamed'}'. Actions must be registered.`,
            node,
            'workflow-parse:unknown-action'
          )
        }

        if (action) {
          try {
            action.validate(attributes, true)
          } catch(e) {
            if (e instanceof z.ZodError) {
              for (const issue of e.issues) {
                file.fail(
                  `Invalid action attributes at /${issue.path.join('.')}. ${issue.message}`,
                  node,
                  'workflow-parse:invalid-action-attributes'
                )
              }
            }
          }
        }

        parent!.children[i] = u('action', { name, children, attributes, position })
        return CONTINUE
      }

      if (is(node, 'mdxJsxTextElement')) {
        file.fail('Action must be a block-level element', node, 'workflow-parse:action-inline')
        return SKIP
      }

      if (is(node, 'mdxFlowExpression') || is(node, 'mdxTextExpression')) {
        validateEstree(node.data!.estree as Program, file)

        const expression = u('expression', {
          data: node.data,
          value: node.value,
          position: node.position,
        })

        if (is(node, 'mdxFlowExpression')) {
          parent!.children[i] = u('paragraph', [expression])
        } else {
          parent!.children[i] = expression
        }

        return SKIP
      }
    })
  }
}

const AST_WHITELIST: Node['type'][] = [
  'Program',
  'ExpressionStatement',
  'ArrayExpression',
  'ArrowFunctionExpression',
  'AssignmentExpression',
  'BinaryExpression',
  'CallExpression',
  'ChainExpression',
  'ConditionalExpression',
  'Identifier',
  'Literal',
  'LogicalExpression',
  'MemberExpression',
  'ObjectExpression',
  'Property',
  'SpreadElement',
  'TemplateLiteral',
  'TemplateElement',
  'UnaryExpression',
  'UpdateExpression',
  'VariableDeclaration',
  'VariableDeclarator',
  'BlockStatement',
  'ReturnStatement',
  'FunctionExpression',
]

const IDENTIFIER_BLACKLIST: string[] = [
  'eval',
  'Function',
  'window',
  'document',
  'global',
  'globalThis',
  'process',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'clearImmediate',
  'Promise',
  'Proxy',
  'Reflect',
  'constructor',
  '__proto__',
  'prototype',
]

export function validateEstree(program: Program, file: VFile) {
  for (const stmt of program.body) {
    if (stmt.type !== 'ExpressionStatement') {
      file.fail(
        'Invalid workflow expression. Only simple expression statements are supported.',
        stmt,
        'workflow-parse:invalid-expression'
      )
    }
  }

  walk(program, {
    enter(node) {
      if (!AST_WHITELIST.includes(node.type)) {
        file.fail(
          `Unsupported JavaScript syntax '${node.type}' in workflow expression.`,
          node,
          'workflow-parse:unsupported-syntax'
        )
      }

      if (node.type === 'Identifier' && IDENTIFIER_BLACKLIST.includes(node.name)) {
        file.fail(
          `Restricted identifier '${node.name}' used in workflow expression.`,
          node,
          'workflow-parse:restricted-identifier'
        )
      }

      if (
        (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression')
        && node.async
      ) {
        file.fail(
          'Async functions are not supported in workflow expressions.',
          node,
          'workflow-parse:async-function-not-allowed'
        )
      }
    }
  })
}
