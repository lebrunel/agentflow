import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { z } from 'zod'
import { generate, FORMAT_MINIFY } from 'escodegen-wallaby'
import { camelCase, kebabCase } from 'change-case'
import { VFile } from 'vfile'
import { VFileMessage } from 'vfile-message'
import nPath from 'path-browserify'
import yaml from 'yaml'
import { stringify } from './stringifier'
import { getExpressionDependencies } from '../exec'

import type { Node as EsNode } from 'estree-jsx'
import type { Root } from 'mdast'
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import type { MdVisitor, EsVisitor } from './visitor'
import type { Environment } from '../env'
import type { Processor } from 'unified'

// Transformers

/**
 * A transformer that parses YAML frontmatter nodes and adds the parsed data to
 * `node.data`. If parsing fails, the error is reported as VFile messages.
 */
export function parseFrontmatter(): MdVisitor {
  return (ctx, node) => {
    if (is(node, 'yaml')) {
      try {
        node.data = yaml.parse(node.value)
      } catch (e: unknown) {
        ctx.file.fail(e as Error, node, 'workflow-parse:yaml-error')
      }
    }
  }
}


/**
 * Transformer that removes markdown blockquotes from the AST since they are
 * treated as comments in workflows.
 */
export function removeComments(): MdVisitor {
  return (ctx, node) => {
    if (is(node, 'blockquote')) {
      ctx.remove()
      ctx.skip()
    }
  }
}

/**
 * Processes JSX elements that may represent workflow actions. When transform=true,
 * converts matching elements into action nodes and validates their attributes.
 * When transform=false, checks for potential actions in fragments and adds
 * warning messages since fragment actions are treated as plain text.
 * Fails on invalid attributes or inline actions.
 */
export function visitActions(
  env: Environment,
  { transform = false }: { transform?: boolean } = {},
): MdVisitor {
  return (ctx, node) => {
    if (is(node, 'mdxJsxFlowElement') || is(node, 'mdxJsxTextElement')) {
      const name = kebabCase(node.name || '')

      try {
        // useAction will throw if action does not exist
        const action = env.useAction(name)

        if (transform && is(node, 'mdxJsxTextElement')) {
          ctx.file.fail(
            'Action must be a block-level element',
            node,
            'workflow-parse:inline-action'
          )
        }

        if (transform) {
          const { children, position } = node
          const attributes = action.parse(parseAttributes(node, ctx.file))

          ctx.replace(u('action', {
            name,
            children,
            attributes,
            position,
          }))
          ctx.skip()
        } else {
          ctx.file.info(
            `Action <${name}> found in fragment - actions in fragments are treated as plain text and will be ignored`,
            node,
            'workflow-parse:fragment-action'
          )
        }
      } catch(e) {
        // If it's already a VFileMessage, let it bubble up
        if (e instanceof VFileMessage) { throw e }

        // If Zod Error than an attribute is invlid
        if (e instanceof z.ZodError) {
          for (const issue of e.issues) {
            ctx.file.fail(
              `Invalid action attributes at /${issue.path.join('.')}. ${issue.message}`,
              node,
              'workflow-parse:invalid-action-attributes'
            )
          }
        }

        // If the error comes from the action not being found, then we treat
        // this node as html/xml text, and give warning
        ctx.file.info(
          `Element <${name}> not recognized as a registered action - treating as plain text`,
          node,
          'workflow-parse:jsx-element-warning'
        )
      }
    }
  }
}

/**
 * Transforms MDX expressions into expression nodes, preserving their flow/text
 * type and other node data.
 */
export function transformExpressions(): MdVisitor {
  return (ctx, node) => {
    if (is(node, 'mdxFlowExpression') || is(node, 'mdxTextExpression')) {
      const replacement = u('expression', {
        expressionType: is(node, 'mdxFlowExpression') ? 'flow' : 'text',
        data: node.data,
        value: node.value,
        position: node.position,
      })
      ctx.replace(replacement)
      ctx.skip()
    }
  }
}

/**
 * Regenerates expression value from the ESTree after potential transformations.
 * Optionally escapes the generated code.
 */
export function rewriteExpressions(escape: boolean = false): MdVisitor {
  return (_ctx, node) => {
    if (is(node, 'expression')) {
      const value = generate(node.data!.estree!, { format: FORMAT_MINIFY })
      node.value = escape ? JSON.stringify(value).slice(1, -1) : value
    }
  }
}

/**
 * Transforms JSX fragment nodes into _fragment() call expressions. The fragment
 * content is processed, stringified, and passed as the first argument. Any
 * variable dependencies are passed as a second argument object.
 */
export function transformJsxFragments(
  processor: Processor<Root, Root, Root, Root, string>,
): EsVisitor {
  return (ctx, node) => {
    if (node.type === 'JSXFragment') {
      const proc = processor()
      const fragmentSrc: string = generate({ type: 'Program', body: node.children }, { format: FORMAT_MINIFY })
      const fragmentAst = proc.parse(fragmentSrc)
      const fragment = stringify(proc.runSync(fragmentAst, ctx.file))
      const deps: string[] = getExpressionDependencies(node)

      ctx.replace({
        type: 'CallExpression',
        optional: false,
        callee: { type: 'Identifier', name: '_fragment' },
        arguments: [
          { type: 'Literal', value: fragment },
          {
            type: 'ObjectExpression',
            properties: deps.map(name => ({
              type: 'Property',
              key: { type: 'Identifier', name },
              value: { type: 'Identifier', name },
              kind: 'init',
              computed: false,
              method: false,
              shorthand: true,
            }))
          }
        ]
      })
    }
  }
}


/**
 * Transforms include() function calls to _fragment() calls by loading and
 * processing the referenced prompt content. Handles circular dependencies and
 * validates input. The prompt content is parsed, processed and passed as a
 * string argument to _fragment().
 */
export function transformIncludeFunctions(
  env: Environment,
  processor: Processor<Root, Root, Root, Root, string>,
): EsVisitor {
  return (ctx, node) => {
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'include'
    ) {
      try {
        if (
          node.arguments.length < 1 ||
          node.arguments[0].type !== 'Literal' ||
          typeof node.arguments[0].value !== 'string'
        ) {
          throw new Error('first argument must be a string literal')
        }

        const name = nPath.normalize(node.arguments[0].value)
        const stack = processor.data('includeStack') || []

        if (stack.includes(name)) {
          const cycle = [...stack, name].join(' > ')
          throw new Error(`circular dependency: ${cycle}`)
        }

        const proc = processor().data('includeStack', [...stack, name])
        const fragmentSrc: string = env.usePrompt(name)
        const fragmentAst = proc.parse(fragmentSrc)
        const fragment = stringify(proc.runSync(fragmentAst, ctx.file))

        ctx.replace({
          type: 'CallExpression',
          optional: false,
          callee: { type: 'Identifier', name: '_fragment' },
          arguments: [
            { type: 'Literal', value: fragment }
          ],
        })

      } catch(e) {
        // If it's already a VFileMessage, let it bubble up
        if (e instanceof VFileMessage) throw e

        ctx.file.fail(
          `include() error: ${(e as Error).message}`,
          node,
          'workflow-parse:todo'
        )
      }
    }
  }
}

// Validators

const AST_WHITELIST: EsNode['type'][] = [
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
  'TaggedTemplateExpression',
  'TemplateLiteral',
  'TemplateElement',
  'UnaryExpression',
  'UpdateExpression',
  'VariableDeclaration',
  'VariableDeclarator',
  'BlockStatement',
  'ReturnStatement',
  'FunctionExpression',

  'JSXElement',
  'JSXOpeningElement',
  'JSXClosingElement',
  'JSXFragment',
  'JSXOpeningFragment',
  'JSXClosingFragment',
  'JSXAttribute',
  'JSXIdentifier',
  'JSXText',
  'JSXExpressionContainer',
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

/**
 * Validates that Program nodes only contain ExpressionStatement nodes.
 * Fails with an error if any other statement types are encountered.
 */
export function validateProgram(): EsVisitor {
  return (ctx, node) => {
    if (node.type === 'Program') {
      for (const stmt of node.body) {
        if (stmt.type !== 'ExpressionStatement') {
          ctx.file.fail(
            'Invalid workflow expression. Only simple expression statements are supported.',
            stmt,
            'workflow-parse:invalid-expression'
          )
        }
      }
    }
  }
}

/**
 * Validates that the ESTree node type is included in the AST_WHITELIST array.
 * Fails with an error if an unsupported syntax is encountered.
 */
export function validateNodeWhitelist(): EsVisitor {
  return (ctx, node) => {
    if (!AST_WHITELIST.includes(node.type)) {
      ctx.file.fail(
        `Unsupported JavaScript syntax '${node.type}' in workflow expression.`,
        node,
        'workflow-parse:unsupported-syntax'
      )
    }
  }
}

/**
 * Checks Identifier nodes against a blacklist of restricted identifiers like
 * `eval` and other off-limit globals. Fails on a blacklisted identifier.
 */
export function validateIdentifierBlacklist(): EsVisitor {
  return (ctx, node) => {
    if (node.type === 'Identifier' && IDENTIFIER_BLACKLIST.includes(node.name)) {
      ctx.file.fail(
        `Restricted identifier '${node.name}' used in workflow expression.`,
        node,
        'workflow-parse:restricted-identifier'
      )
    }
  }
}

/**
 * Fails if any async functions are found in expressions since they are not
 * supported. Checks both function expressions and arrow functions.
 */
export function validateAsyncFunctions(): EsVisitor {
  return (ctx, node) => {
    if (
      (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression')
      && node.async
    ) {
      ctx.file.fail(
        'Async functions are not supported in workflow expressions.',
        node,
        'workflow-parse:async-function-not-allowed'
      )
    }
  }
}

// Helpers

function parseAttributes(
  node: MdxJsxFlowElement | MdxJsxTextElement,
  file: VFile,
): Record<string, any> {
  const attributes: Record<string, any> = {}

  for (const attr of node.attributes) {
    if (attr.type === 'mdxJsxAttribute') {
      const propName = camelCase(attr.name)

      if (is(attr.value, 'mdxJsxAttributeValueExpression')) {
        attributes[propName] = u('expression', {
          expressionType: 'attribute',
          data: attr.value.data,
          value: attr.value.value,
          position: node.position,
        })
      } else {
        attributes[propName] = attr.value
      }
    } else {
      file.fail(
        'Unsupported attribute syntax in Action. Use key-value pairs only.',
        attr,
        'workflow-parse:unsupported-attribute-syntax'
      )
    }
  }

  return attributes
}
