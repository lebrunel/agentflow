import { unified } from 'unified'
import { u } from 'unist-builder'
import { visit, SKIP } from 'unist-util-visit'
import remarkStringify from 'remark-stringify'
import { evalExpressionSync } from '../runtime/eval'

import type { Root, RootContent } from 'mdast'
import type { ContextValue, ContextValueMap, ContextImageValue } from './types'

/**
* Converts JavaScript native types to ContextValue objects.
 */
export function toContext(value: ContextValue['value']): ContextValue {
  switch(typeof value) {
    case 'string':
      return { type: 'text', value }
    case 'object':
      return { type: 'image', value }
    default:
      return { type: 'text', value: String(value) }
  }
}

export function astToContext(
  nodes: RootContent[],
  context: ContextValueMap = {},
): ContextValue[] {
  const blocks: Array<Root | ContextImageValue> = [
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
      return { type: 'text', value: astStringify(block) }
    } else {
      return block
    }
  })
}

export function astStringify(nodes: Root | RootContent[]): string {
  if (Array.isArray(nodes)) {
    return astStringify(u('root', nodes))
  }

  return unified()
    .use(remarkStringify)
    .stringify(nodes)
    .trim()
}

export function contextStringify(ctx: ContextValue | ContextValue[]): string {
  if (Array.isArray(ctx)) {
    return ctx.map(contextStringify).join('\n\n')
  }

  switch(ctx.type) {
    case 'text':
      return ctx.value
    case 'image':
      return `![IMAGE](${ctx.value.name})`
    default:
      throw new Error(`Unrecognised context type: ${JSON.stringify(ctx)}`)
  }
}
