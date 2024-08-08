import { Type, type Static } from '@sinclair/typebox'
import type { RootContent } from 'mdast'
import type { ActionNode } from '../ast'

/**
 * **Action** - An individual step within a phase, representing a single request
 * sent to the LLM for generating a response.
 */
export abstract class Action {
  #node: ActionNode;
  contentNodes: RootContent[];

  constructor(node: ActionNode, content: RootContent[]) {
    this.#node = node
    this.contentNodes = content
  }

  get props(): ActionProps {
    return this.#node.data
  }

  abstract execute(): Promise<ActionResult>;
}

// Schemas

export const ModelSchema = Type.Object({
  name: Type.String(),
  provider: Type.Optional(Type.String()),
})

export const ActionPropsSchema = Type.Object({
  name: Type.String(),
  model: Type.Union([
    Type.String(),
    ModelSchema,
  ]),
})

// Types

export type ActionProps = Static<typeof ActionPropsSchema>

export type ActionResult = any