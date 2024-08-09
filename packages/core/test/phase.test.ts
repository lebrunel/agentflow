import { describe, expect, test } from 'bun:test'
import { default as dd } from 'ts-dedent'
import { Workflow } from '../src/workflow'

describe('Phase', () => {
  const workflow = Workflow.parse(dd`
  # Sample workflow

  This is an instruction

  \`\`\`generate
  name: foo1
  model: test
  \`\`\`

  This is a second instruction

  \`\`\`generate
  name: foo2
  model: test
  \`\`\`

  This is a third instruction

  \`\`\`generate
  name: foo3
  model: test
  \`\`\`
  `)

  test('has iterable actions', () => {
    const phase = workflow.phases[0]
    const actions = [...phase.actions]
    expect(actions.length).toBe(3)
    expect(actions[0].name).toBe('foo1')
    expect(actions[0].getContent({})).toBe('# Sample workflow\n\nThis is an instruction')
    expect(actions[2].name).toBe('foo3')
    expect(actions[2].getContent({})).toBe('This is a third instruction')
  })
})