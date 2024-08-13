import { Type } from '@sinclair/typebox'
import { defineAction } from '~/runtime/action'

const schema = Type.Object({
  model: Type.String(),
  stream: Type.Optional(Type.Boolean()),
})

export const generateText = defineAction({
  name: 'generate',
  schema,
  execute(ctx, input, prevResults) {
    // implementation
    return { type: 'text', text: 'todo' }
  }
})