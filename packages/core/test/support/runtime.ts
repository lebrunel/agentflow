import { z } from 'zod'
import { actions, defineAction, Runtime, type ContextValue } from '~/index'

export const mockAction = defineAction({
  name: 'mock',
  schema: z.object({
    value: z.string(),
  }),
  execute({ props }) {
    return { result: { type: 'primitive', value: props.value } }
  }
})

export const runtime = new Runtime({
  actions: [
    //actions.loop,
    mockAction
  ]
})
