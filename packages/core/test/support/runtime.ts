import { Type } from '@sinclair/typebox'
import { Runtime } from '~/index'
import { defineAction } from '~/index'

export const mockAction = defineAction({
  name: 'mock',
  schema: Type.Object({
    type: Type.Literal('text'),
    text: Type.String(),
  }),
  execute(ctx, _runtime) {
    return { output: ctx.action.props }
  }
})

export const runtime = new Runtime({
  actions: [ mockAction ]
})
