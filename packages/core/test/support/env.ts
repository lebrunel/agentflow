import { z } from 'zod'
import { defineAction, Environment } from 'src/index'

export const mockAction = defineAction({
  name: 'mock',
  schema: z.object({
    value: z.string(),
  }),
  execute(_ctx, props) {
    return { type: 'primitive', value: props.value }
  }
})

export const env = new Environment({
  actions: [
    mockAction
  ]
})