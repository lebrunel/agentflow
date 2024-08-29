import { unified } from 'unified'
import { u } from 'unist-builder'
import { visit, SKIP } from 'unist-util-visit'
import remarkStringify from 'remark-stringify'
import { default as dd } from 'ts-dedent'
import { evalExpressionSync } from '../runtime/eval'

import type { Root, RootContent } from 'mdast'
import type { ContextValue, ContextValueMap } from './types'

/**
* Converts JavaScript native types to ContextValue objects.
 */
export function toContext(value: ContextValue['value']): ContextValue {
  switch(typeof value) {
    case 'string':
      return { type: 'text', value }

    case 'object':
      // Is image
      if (['name', 'type', 'data'].every(k => k in value)) {
        return { type: 'image', value }
      // Or json
      } else {
        return { type: 'json', value }
      }

    default:
      return { type: 'text', value: String(value) }
  }
}

export function astToContext(
  nodes: RootContent[],
  context: ContextValueMap = {},
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
    visit(node, 'expression', (node, i, parent) => {
      const contextValue = toContext(
        evalExpressionSync(node.data!.estree!, context)
      )
      if (contextValue.type === 'text') {
        parent!.children[i as number] = u('text', { value: contextValue.value })
        return SKIP
      } else {
        parent!.children.splice(i as number, 1)
        blocks.push({ ...contextValue })
        return [SKIP, i as number]
      }
    })

    const root = getLastRoot()
    root.children.push(node)
  }

  return blocks.map(block => {
    if ('children' in block) {
      return { type: 'text', value: stringifyAST(block) }
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
    case 'text':
      return ctx.value
    case 'image':
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
