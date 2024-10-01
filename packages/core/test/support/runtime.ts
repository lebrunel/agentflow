import { z } from 'zod'
import { defineAction, Runtime } from 'src/index'

export const mockAction = defineAction({
  name: 'mock',
  schema: z.object({
    value: z.string(),
  }),
  execute(props) {
    return { type: 'primitive', value: props.value }
  }
})

export const runtime = new Runtime({
  actions: [
    mockAction
  ]
})
