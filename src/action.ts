import { Type, type Static } from '@sinclair/typebox'

/**
 * **Action** - An individual step within a phase, representing a single request
 * sent to the LLM for generating a response.
 */
export class Action {

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
