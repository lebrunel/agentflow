import { z } from 'zod'
import { actions, defineAction, Runtime } from '~/index'

export const mockAction = defineAction({
  name: 'mock',
  schema: z.object({
    type: z.literal('text'),
    value: z.string(),
  }),
  execute(props) {
    return { result: props }
  }
})

export const runtime = new Runtime({
  actions: [
    //actions.loop,
    mockAction
  ]
})
