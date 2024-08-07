import { Type, type Static } from '@sinclair/typebox'
import { unified } from 'unified'
import { u } from 'unist-builder'
import remarkStringify from 'remark-stringify'
import type { RootContent } from 'mdast'
import type { ActionNode } from './ast'

/**
 * **Action** - An individual step within a phase, representing a single request
 * sent to the LLM for generating a response.
 */
export class Action {
  #node: ActionNode;
  content: string;
  contentNodes: RootContent[];

  constructor(node: ActionNode, content: RootContent[]) {
    this.#node = node
    this.content = stringifyContent(content)
    this.contentNodes = content
  }

  get props(): ActionProps {
    return this.#node.data
  }
}

function stringifyContent(nodes: RootContent[]): string {
  return unified()
    .use(remarkStringify)
    .stringify(u('root', nodes))
    .trim()
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
