import { Type, type Static } from '@sinclair/typebox'
import { unified, type Transformer } from 'unified'
import { u } from 'unist-builder'
import remarkStringify from 'remark-stringify'
import type { Paragraph, Root, RootContent } from 'mdast'
import type { ActionNode, ContextNode } from '../ast'
import type { ContextMap, ContextValue } from '../context'
import { visit } from 'unist-util-visit'

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

  get name(): string {
    return this.props.name
  }

  get props(): ActionProps {
    return this.#node.data
  }

  getContent(context: ContextMap): string {
    return unified()
      .use(interpolateContext, context)
      .use(remarkStringify)
      .stringify(u('root', this.contentNodes))
      .trim()
  }

  abstract execute(
    context: ContextMap,
    prevResults: ActionResult[],
  ): Promise<ActionResult>;
}

function interpolateContext(context: ContextMap): Transformer<Root> {
  return root => {
    visit(root, 'context', (node, i, parent) => {
      // todo - handle different ContextValue types
      const contextValue = context[node.value] as ContextValue & { type: 'text' }
      parent!.children[i as number] = u('text', { value: contextValue.text })
      return 'skip'
    })
  }
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

export interface ActionResult {
  type: string;
  name: string;
  input: ContextValue;
  output: ContextValue;
}