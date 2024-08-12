import { Type, type Static } from '@sinclair/typebox'
import { Action, type ActionProps, type ActionResult } from '../action'
import type { ContextValueMap } from '../context'

export class MockAction extends Action<Props> {
  schema = MockProps

  async execute(context: ContextValueMap, prevResults: ActionResult[]): Promise<ActionResult> {
    const input = this.getContent(context)

    return {
      type: 'mock',
      name: this.name,
      input: { type: 'text', text: input },
      output: this.props,
    }
  }
}

// Schema

const MockProps = Type.Object({
  type: Type.Literal('text'),
  text: Type.String(),
})

// Types

type Props = ActionProps & Static<typeof MockProps>