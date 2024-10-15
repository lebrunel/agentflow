import { z } from 'zod'
import { defineAction } from '../action'

export const loopAction = defineAction({
  name: 'loop',
  schema: z.object({
    until: z.boolean(),
    provide: z.record(z.string(), z.any()).default({}),
  }),
  execute() { throw new Error('no-op. action logic built in to controller') }
})

export const condAction = defineAction({
  name: 'cond',
  schema: z.object({
    if: z.boolean(),
    provide: z.record(z.string(), z.any()).default({}),
  }),
  execute() { throw new Error('no-op. action logic built in to controller') }
})
