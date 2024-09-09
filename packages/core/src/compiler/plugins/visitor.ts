import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { visit, CONTINUE, SKIP } from 'unist-util-visit'
import { camelCase, kebabCase } from 'change-case'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { WorkflowInputSchema } from '../../runtime'

import type { Root } from 'mdast'
import type { Transformer } from 'unified'
import type { ExpressionNode } from '../ast'
import type { CompileOptions } from '../compiler'
import type { Action } from '~/action'

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

        for (const attr of node.attributes) {
          if (attr.type === 'mdxJsxAttribute') {
            const propName = camelCase(attr.name)
            const value = is(attr.value, 'mdxJsxAttributeValueExpression')
              ? {
                  type: 'expression',
                  data: attr.value.data,
                  value: attr.value.value,
                  position: node.position
                } as ExpressionNode
              : attr.value
            attributes[propName] = value
          } else {
            file.message(
              'Unsupported attribute syntax in Action. Use key-value pairs only.',
              attr,
              'workflow-parse:unsupported-attribute-syntax'
            )
          }
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

      // todo - validate expression statement
      // check for function calls
      if (
        (is(node, 'mdxFlowExpression') || is(node, 'mdxTextExpression')) &&
        node.data?.estree?.body.some(s => s.type !== 'ExpressionStatement')
      ) {
        //file.fail(
        //  'Invalid expression. Only simple expression statements are supported.',
        //  node,
        //  'workflow-parse:invalid-expression'
        //)
      }

      if (is(node, 'mdxFlowExpression')) {
        parent!.children[i] = u('paragraph', [
          u('expression', {
            value: node.value,
            position: node.position,
            data: node.data,
          })
        ])
        return SKIP
      }

      if (is(node, 'mdxTextExpression')) {
        parent!.children[i] = u('expression', {
          value: node.value,
          position: node.position,
          data: node.data,
        })
        return SKIP
      }
    })
  }
}
