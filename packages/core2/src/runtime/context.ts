import { unified } from 'unified'
import { u } from 'unist-builder'
import { visit, SKIP } from 'unist-util-visit'
import remarkStringify from 'remark-stringify'
import type { Root, RootContent } from 'mdast'

import type { ContextValue, ContextValueMap, ContextImageValue } from '../workflow/context'
import { evalExpression } from './eval'

export function nodesToContext(nodes: RootContent[] | Readonly<RootContent[]>, context: ContextValueMap = {}): ContextValue[] {
  const blocks: Array<Root | ContextImageValue> = [
    u('root', [])
  ]

  function getTip(): Root {
    const tip = blocks[blocks.length - 1]
    if ('children' in tip) {
      return tip
    } else {
      const tip = u('root', [])
      blocks.push(tip)
      return tip
    }
  }

  for (const node of nodes) {
    const tip = getTip()
    visit(node, 'expression', (node, i, parent) => {
      const tree = node.data!.estree!
      const contextValue: ContextValue = evalExpression(tree, context) // todo - use vm here
      if (contextValue.type === 'text') {
        parent!.children[i as number] = u('text', { value: contextValue.value })
        return SKIP
      } else {
        parent!.children.splice(i as number, 1)
        blocks.push({ ...contextValue })
        return [SKIP, i as number]
      }
    })
    tip.children.push(node)
  }

  return blocks.map(block => {
    if ('children' in block) {
      const value = unified()
        .use(remarkStringify)
        .stringify(block)
        .trim()
      return { type: 'text', value }
    } else {
      return block
    }
  })
}

export function contextToString(ctx: ContextValue | ContextValue[]): string {
  if (Array.isArray(ctx)) {
    return ctx.map(contextToString).join('\n\n')
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
