import { z } from 'zod'
import { defineAction } from '../action'

export default defineAction({
  name: 'cond',

  schema: z.object({
    if: z.boolean(),
    provide: z.record(z.string(), z.any()).default({}),
  }),

  execute: async function (ctx, props) {
    if (props.if) {
      const results = await ctx.runChildren({
        beforeAll() {
          ctx.pushContext(props.provide)
        },

        afterStep({ cursor, stop }) {
          // The child runner always loops the cursor back to 0, so if after any
          // step the cursor is back to 0 we can stop the loop
          if (cursor.phaseIndex === 0 && cursor.stepIndex === 0) {
            stop()
          }
        },
      })

      return { type: 'json', value: results[0] }

    } else {
      return { type: 'primitive', value: undefined }
    }
  }
})
