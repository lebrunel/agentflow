import type { RootContent } from 'mdast'

import type { ActionNode } from './ast'

/**
 * **Action** - An individual step within a phase, representing a single request
 * sent to the LLM for generating a response.
 */
export class Action<T = any> {
  #node: ActionNode
  content: RootContent[]

  constructor(node: ActionNode, content: RootContent[]) {
    this.#node = node
    this.content = content
  }

  get name(): string {
    return this.#node.data.name
  }

  get type(): string {
    return this.#node.data.type
  }

  get props(): T {
    return this.#node.data.props
  }
}