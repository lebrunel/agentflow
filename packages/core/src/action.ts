import { Value } from '@sinclair/typebox/value'
import { stringifyWithContext } from './processor'
import { dd } from './util'

import type { TSchema } from '@sinclair/typebox'
import type { CompletionTokenUsage } from 'ai'
import type { RootContent } from 'mdast'
import type { Pushable } from 'it-pushable'
import type { ActionNode } from './ast'
import type { ContextValueMap, ContextValue } from './context'

/**
 * **Action** - An individual step within a phase, representing a single request
 * sent to the LLM for generating a response.
 */
export abstract class Action<P extends ActionProps = ActionProps> {
  #node: ActionNode<P>
  #content: RootContent[]
  stream?: Pushable<string>

  constructor(node: ActionNode<P>, content: RootContent[]) {
    this.#node = node
    this.#content = content
  }

  get name(): string {
    return this.#node.data.name
  }

  get props(): P {
    return this.#node.data.props
  }

  getContent(context: ContextValueMap): string {
    return stringifyWithContext(this.#content, context)
  }

  validate(): void {
    const error = Value.Errors(this.schema, this.props).First()
    if (error) {
      throw new Error(dd`
      Invalid action as line ${this.#node.position!.start.line}.
        Path: ${error.path}
        Error: ${error.message}
        Value: ${JSON.stringify(error.value)}
      `)
    }
  }

  abstract get schema(): TSchema;

  abstract execute(
    context: ContextValueMap,
    prevResults: ActionResult[],
  ): Promise<ActionResult>;
}

// Types

export interface ActionProps {}

export interface ActionResult {
  type: string;
  name: string;
  input: ContextValue;
  output: ContextValue;
  usage?: CompletionTokenUsage;
}
