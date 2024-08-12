import { describe, expect, test } from 'bun:test'

import { Workflow } from '~/workflow'
import { dd } from '~/util'

describe('Phase', () => {
  const workflow = Workflow.parse(dd`
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
  `)

  test('has iterable actions', () => {
    const phase = workflow.phases[0]
    const actions = [...phase.actions]
    expect(actions.length).toBe(3)
    expect(actions[0].name).toBe('foo')
    expect(actions[0].getContent({})).toBe('# Sample workflow\n\nThis is an instruction')
    expect(actions[2].name).toBe('qux')
    expect(actions[2].getContent({})).toBe('This is a third instruction')
  })
})