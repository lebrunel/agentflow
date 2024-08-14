import { Type } from '@sinclair/typebox'
import { Runtime } from '~/index'
import { defineAction } from '~/index'

export const mockAction = defineAction({
  name: 'mock',
  schema: Type.Object({
    type: Type.Literal('text'),
    text: Type.String(),
  }),
  execute({ props }, _input, _prevResults) {
    return props
  }
})

export const runtime = new Runtime({
  actions: { mock: mockAction }
})
