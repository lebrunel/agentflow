import { unified } from 'unified'
import { u } from 'unist-builder'
import { visit } from 'unist-util-visit'
import remarkStringify from 'remark-stringify'
import type { Root, RootContent } from 'mdast'
import type { Transformer } from 'unified'

import type { ContextValue, ContextValueMap } from './runtime/context'


export { default as dd } from 'ts-dedent'

export function stringifyNodes(nodes: RootContent[], context: ContextValueMap = {}): string {
  const file = unified()
    .use(insertContext, context)
    .runSync(u('root', nodes))

  return unified()
    .use(remarkStringify)
    .stringify(file)
    .trim()
}

function insertContext(context: ContextValueMap): Transformer<Root> {  
  return root => {
    visit(root, 'context', (node, i, parent) => {
      // todo - handle different ContextValue types
      const contextValue = context[node.value] as ContextValue & { type: 'text' }
      parent!.children[i as number] = u('text', { value: contextValue.text })
      return 'skip'
    })
  }
}