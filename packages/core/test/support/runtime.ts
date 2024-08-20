import { z } from 'zod'
import { Runtime } from '~/index'
import { defineAction } from '~/index'

export const mockAction = defineAction({
  name: 'mock',
  schema: z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  execute(ctx, _runtime) {
    return { output: ctx.action.props }
  }
})

export const runtime = new Runtime({
  actions: [ mockAction ]
})
