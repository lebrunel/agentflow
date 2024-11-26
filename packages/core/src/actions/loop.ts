import { z } from 'zod'
import { defineAction } from '../action'

export default defineAction({
  name: 'loop',
  schema: z.object({
    until: z.boolean(),
    provide: z.record(z.string(), z.any()).default({}),
  }),
  helpers: function(ctx) {
    return {
      index: () => ctx.getCursor().iteration,
      self: () => ctx.getScopedActionResults(),
      last: () => {
        const results = ctx.getScopedActionResults()
        return results[results.length - 1]
      }
    }
  },
  execute: async function(ctx, props) {
    ctx.pushCursor()

    await ctx.runChildren({
      beforeEach({ cursor, stop }) {
        // If before any step the cursor is 0 and the break condition is true,
        // we stop the loop. Otherwise we push a new context for this iteration.
        if (cursor.phaseIndex === 0 && cursor.stepIndex === 0) {
          if (props.until) {
            stop()
          } else if (props.provide) {
            ctx.pushContext(props.provide)
          }
        }
      }
    })

    const value = ctx.getScopedActionResults()
    ctx.popCursor()
    return { type: 'json', value }
  }
})
