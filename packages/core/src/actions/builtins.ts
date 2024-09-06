import { z } from 'zod'
import { defineAction } from '../action'

export const loopAction = defineAction({
  name: 'loop',
  schema: z.object({
    until: z.boolean(),
    inject: z.record(z.string(), z.any()).default({}),
  }),
  execute() { throw new Error('no-op. action logic built in to controller') }
})

export const ifAction = defineAction({
  name: 'if',
  schema: z.object({
    condition: z.boolean(),
    inject: z.record(z.string(), z.any()).default({}),
  }),
  execute() { throw new Error('no-op. action logic built in to controller') }
})
