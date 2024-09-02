import { z } from 'zod'
import { defineAction } from '../action'

const schema = z.object({
  until: z.boolean(),
  inject: z.record(z.any()).default({})
})

export default defineAction({
  name: 'loop',
  schema,
  execute: (ctx, runtime) => {
    return {

      // todo
      // build initial context from props.inject
      // iterate over and execute the phases
      // final context gets returned as json value

      output: { type: 'json', value: {} }
    }
  }
})
