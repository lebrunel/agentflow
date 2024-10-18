import { unified } from 'unified'
import { u } from 'unist-builder'
import { selectAll } from 'unist-util-select'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { dedent as dd } from 'ts-dedent'
import { evalExpression } from '../runtime/eval'

import type { Root, RootContent } from 'mdast'
import type { Options } from 'remark-stringify'
import type { ContextValue, ContextValueMap } from './types'
import type { CustomHandlers, ExpressionNode } from '../compiler'

/**
 * TODO
 */
export function fromContextValue(ctx: ContextValue): ContextValue['value'] {
  return ctx.value
}

/**
 * TODO
 */
export function toContextValue(value: any): ContextValue {
  if (typeof value === 'symbol' && value.description === 'fail') {
    return { type: 'primitive', value: '!err' }
  }

  if (['string', 'number', 'boolean', 'null', 'undefined'].includes(typeof value)) {
    return { type: 'primitive', value: value as string | number | boolean | null | undefined }
  }

  if (value instanceof File) {
    return { type: 'file', value }
  }

  return { type: 'json', value }
}

/**
 * TODO
 */
export function unwrapContext(ctx: ContextValueMap): Record<string, ContextValue['value']> {
  return Object.entries(ctx).reduce((obj, [key, value]) => {
    obj[key] = fromContextValue(value)
    return obj
  }, {} as Record<string, ContextValue['value']>)
}

/**
 * TODO
 */
export function wrapContext(obj: Record<string, any>): ContextValueMap {
  return Object.entries(obj).reduce((ctx, [key, value]) => {
    ctx[key] = toContextValue(value)
    return ctx
  }, {} as ContextValueMap)
}

/**
 * TODO
 */
export function astToContext(
  nodes: RootContent[],
  context: ContextValueMap,
  helpers: Record<string, any> = {},
): ContextValue[] {
  const blocks: Array<Root | ContextValue> = [
    u('root', [])
  ]

  // If the last block is a Root, return that
  // Otherwise, create a Root and return that
  function getLastRoot(): Root {
    const block = blocks[blocks.length - 1]
    if ('children' in block) {
      return block
    } else {
      const root = u('root', [])
      blocks.push(root)
      return root
    }
  }

  for (const node of nodes) {
    const root = getLastRoot()
    const expressions = selectAll('expression', node) as ExpressionNode[]

    // If we have expressions, then we stringify the RootContent node, evaluate
    // the expression and manipulate the string, micro parse the string and
    // replace the node with the new node
    if (expressions.length) {
      let nodeStr = stringifyAST([node])
      for (const expr of expressions) {
        const contextValue = toContextValue(
          evalExpression(expr.value, unwrapContext(context), helpers)
        )

        // Primitives get stringified in place
        // Images get pushed as new content blocks
        if (contextValue.type === 'primitive') {
          nodeStr = nodeStr.replace(`{${expr.value}}`, String(contextValue.value))
        } else {
          nodeStr = nodeStr.replace(`{${expr.value}}`, '')
          blocks.push({ ...contextValue })
        }
      }

      const microRoot = microParse(nodeStr)
      root.children.push(...microRoot.children)
    } else {
      root.children.push(node)
    }
  }

  return blocks.map(block => {
    if ('children' in block) {
      return { type: 'primitive', value: stringifyAST(block) }
    } else {
      return block
    }
  })
}

export function stringifyAST(nodes: Root | RootContent[]): string {
  if (Array.isArray(nodes)) {
    return stringifyAST(u('root', nodes))
  }

  const stringifyOptions: Options & { handlers: Partial<CustomHandlers> } = {
    bullet: '-',
    handlers: {
      expression: (node: ExpressionNode) => `{${node.value}}`
    }
  }

  return unified()
    .use(remarkStringify, stringifyOptions)
    .stringify(nodes)
    .trim()
}

export function stringifyContext(ctx: ContextValue | ContextValue[]): string {
  if (Array.isArray(ctx)) {
    return ctx.map(stringifyContext).join('\n\n')
  }

  switch(ctx.type) {
    case 'primitive':
      return String(ctx.value)

    case 'file':
      return `![${ctx.value.type}](${ctx.value.name})`

    case 'json':
      return dd`
      \`\`\`json
      ${JSON.stringify(ctx.value, null, 2)}
      \`\`\`
      `

    default:
      throw new Error(`Unrecognised context type: ${JSON.stringify(ctx)}`)
  }
}

function microParse(str: string): Root {
  return unified()
    .use(remarkParse)
    .parse(str)
}
