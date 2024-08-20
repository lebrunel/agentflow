import { unified } from 'unified'
import { u } from 'unist-builder'
import { visit, SKIP } from 'unist-util-visit'
import remarkStringify from 'remark-stringify'
import type { Root, RootContent } from 'mdast'

export function nodesToContext(nodes: RootContent[], context: ContextValueMap = {}): ContextValue[] {
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
    visit(node, 'context', (node, i, parent) => {
      const contextValue: ContextValue = context[node.value]
      if (contextValue.type === 'text') {
        parent!.children[i as number] = u('text', { value: contextValue.text })
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
      const text = unified()
        .use(remarkStringify)
        .stringify(block)
        .trim()
      return { type: 'text', text }
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
      return ctx.text
    case 'image':
      return `![IMAGE](${ctx.image.name})`
    default:
      throw new Error(`Unrecognised context type: ${JSON.stringify(ctx)}`)
  }
}

// Types

export type ContextName = string

export type ContextType = 'text' | 'image'

export type ContextTypeMap = Record<ContextName, ContextType>

export type ContextValueMap = Record<ContextName, ContextValue>

export type ContextValue = ContextTextValue | ContextImageValue

export type ContextTextValue = {
  type: 'text',
  text: string,
}

export type ContextImageValue = {
  type: 'image',
  image: {
    name: string,
    type: string,
    data: string,
  }
}
