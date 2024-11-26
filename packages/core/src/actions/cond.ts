import { z } from 'zod'
import { defineAction } from '../action'

export default defineAction({
  name: 'cond',

  schema: z.object({
    if: z.boolean(),
    provide: z.record(z.string(), z.any()).default({}),
  }),

  helpers: function(ctx) {
    return {
      self: () => ctx.getScopedActionResults()[0]
    }
  },

  execute: async function (ctx, props) {
    if (props.if) {
      ctx.pushCursor()
      ctx.pushContext(props.provide)

      await ctx.runChildren({
        afterEach({ cursor, stop }) {
          // The child runner always loops the cursor back to 0, so if after any
          // step the cursor is back to 0 we can stop the loop
          if (cursor.phaseIndex === 0 && cursor.stepIndex === 0) {
            stop()
          }
        }
      })

      const value = ctx.getScopedActionResults()[0]
      ctx.popCursor()
      return { type: 'json', value }

    } else {
      return { type: 'primitive', value: undefined }
    }
  }
})
