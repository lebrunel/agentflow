import { z } from 'zod'
import { defineAction } from '../action'
import { ExecutionCursor } from '../exec'

export default defineAction({
  name: 'loop',
  schema: z.object({
    until: z.coerce.boolean(),
    provide: z.record(z.string(), z.any()).default({}),
  }),
  helpers: function(ctx) {
    const cursorDepth = ctx.getCursor().length

    return {
      index: () => {
        const cursor = ExecutionCursor.trunc(ctx.getCursor(), cursorDepth)
        return cursor.iteration
      },
      self: () => ctx.getScopedContext(),
      last: () => {
        const results = ctx.getScopedContext()
        return results[results.length - 2]
      }
    }
  },
  execute: async function(ctx, props) {
    const results = await ctx.runChildren({
      beforeStep({ cursor, stop }) {
        // If before any step the cursor is 0 and the break condition is true,
        // we stop the loop. Otherwise we push a new context for this iteration.
        if (cursor.phaseIndex === 0 && cursor.stepIndex === 0) {
          if (props.until) {
            stop()
          } else {
            ctx.pushContext(props.provide)
          }
        }
      }
    })

    return { type: 'json', value: results }
  }
})
