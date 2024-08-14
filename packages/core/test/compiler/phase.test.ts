import { describe, expect, test } from 'bun:test'
import { runtime } from 'test/support/runtime'

import { Workflow } from '~/index'
import { dd } from '~/util'

describe('Phase', () => {
  const src = dd`
  # Sample workflow

  This is an instruction

  \`\`\`generate@foo
  model: openai:gpt-4o
  \`\`\`

  This is a second instruction

  \`\`\`generate@bar
  model: openai:gpt-4o
  \`\`\`

  This is a third instruction

  \`\`\`generate@qux
  model: openai:gpt-4o
  \`\`\`
  `
  const workflow = Workflow.parse(src, runtime)

  test('has iterable actions', () => {
    const phase = workflow.phases[0]
    const actions = [...phase.actions]
    expect(actions.length).toBe(3)
    expect(actions.every(a => a.type === 'generate')).toBeTrue()
    expect(actions[0].name).toBe('foo')
    expect(actions[1].name).toBe('bar')
    expect(actions[2].name).toBe('qux')
  })
})