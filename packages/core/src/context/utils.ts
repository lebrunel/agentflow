import { unified } from 'unified'
import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { map } from 'unist-util-map'
import remarkStringify from 'remark-stringify'
import { default as dd } from 'ts-dedent'
import { evalExpression } from '../runtime/eval'

import type { Root, RootContent, Text } from 'mdast'
import type { ComputedContext, ContextValue, ContextValueMap } from './types'


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
  computed: ComputedContext = {},
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

    const newNode = map(node, (node) => {
      if (is(node, 'expression')) {
        const contextValue = toContextValue(
          evalExpression(node.value, unwrapContext(context), computed)
        )

        // Primitive gets stringified inline as a text node
        if (contextValue.type === 'primitive') {
          return u('text', { value: String(contextValue.value) })
          // file and json values get pushed into blocks
        } else {
          blocks.push({ ...contextValue })
          return u('text', { value: '' })
        }
      }

      return node
    }) as RootContent

    root.children.push(newNode)
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

  return unified()
    .use(remarkStringify)
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
