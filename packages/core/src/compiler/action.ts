import type { RootContent } from 'mdast'

import { stringifyNodes } from '~/util'
import type { ActionNode } from '~/compiler/ast'
import type { ContextValue, ContextValueMap } from '~/runtime/context'

/**
 * **Action** - An individual step within a phase, representing a single request
 * sent to the LLM for generating a response.
 */
export class Action {
  #node: ActionNode
  #content: RootContent[]

  constructor(node: ActionNode, content: RootContent[]) {
    this.#node = node
    this.#content = content
  }

  get name(): string {
    return this.#node.data.name
  }

  get type(): string {
    return this.#node.data.type
  }

  get props(): any {
    return this.#node.data.props
  }

  getInputValue(context: ContextValueMap): ContextValue {
    const text = stringifyNodes(this.#content, context)
    return { type: 'text', text }
  }
}