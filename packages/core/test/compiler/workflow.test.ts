import { describe, expect, test } from 'bun:test'
import { VFile } from 'vfile'
import { runtime } from 'test/support/runtime'

import { Workflow } from '~/index'
import { dd } from '~/util'

describe('Workflow.parse()', () => {
  test('title from meta data', () => {
    const src = dd`
    ---
    title: Foo
    ---
    # Bar

    Paragraph
    `
    const workflow = Workflow.parse(src, runtime)
    expect(workflow.title).toBe('Foo')
  })

  test('title from document', () => {
    const src = dd`
    # Bar

    Paragraph
    `
    const workflow = Workflow.parse(src, runtime)
    expect(workflow.title).toBe('Bar')
  })

  test('title from document 2', () => {
    const src = dd`
    # Bar

    Paragraph

    \`\`\`generate@foo
    model: openai:gpt-4o
    \`\`\`
    `
    const workflow = Workflow.parse(src, runtime)
    expect(workflow.title).toBe('Bar')
  })

  test('title from file path', () => {
    const workflow = Workflow.parse(new VFile({
      path: '/path/to/example.md',
      value: 'Paragraph',
    }), runtime)
    expect(workflow.title).toBe('example.md')
  })

  test('fallback to default title', () => {
    const workflow = Workflow.parse('Paragraph', runtime)
    expect(workflow.title).toBe('Untitled')
  })

  test('description from introductory text', () => {
    const src = dd`
    Paragraph

    ---

    More

    \`\`\`generate@foo
    model: openai:gpt-4o
    \`\`\`
    `
    const workflow = Workflow.parse(src, runtime)
    expect(workflow.description).toBe('Paragraph')
  })
})

describe('Workflow.parse() validations', () => {
  test('actions cannot duplicate input context', () => {
    const src = dd`
    ---
    inputs:
      name:
        type: text
    ---

    Paragraph

    \`\`\`generate@name
    model: openai:gpt-4o
    \`\`\`
    `
    expect(() => Workflow.parse(src, runtime)).toThrow(/duplicate context/i)
  })

  test('actions cannot duplicate previous context', () => {
    const src = dd`
    Paragraph

    \`\`\`generate@name
    model: openai:gpt-4o
    \`\`\`

    ---

    Paragraph

    \`\`\`generate@name
    model: openai:gpt-4o
    \`\`\`
    `
    expect(() => Workflow.parse(src, runtime)).toThrow(/duplicate context/i)
  })

  test('context tags can reference existing context', () => {
    const src = dd`
    ---
    inputs:
      name:
        type: text
    ---

    Paragraph

    \`\`\`generate@description
    model: openai:gpt-4o
    \`\`\`

    ---

    Paragraph \`@name\`

    Paragraph \`@description\`
    `
    expect(() => Workflow.parse(src, runtime)).not.toThrow()
  })

  test('context tags cannot reference future context', () => {
    const src = dd`
    ---
    inputs:
      name:
        type: text
    ---

    Paragraph \`@name\`

    Paragraph \`@description\`

    \`\`\`generate@description
    model: openai:gpt-4o
    \`\`\`
    `
    expect(() => Workflow.parse(src, runtime)).toThrow(/context dependency .+ not met/i)
  })
})
