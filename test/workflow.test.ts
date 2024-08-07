import { describe, expect, test } from 'bun:test'
import { default as dd } from 'ts-dedent'
import { Workflow } from '../src/workflow'
import { VFile } from 'vfile'

describe('Workflow.parse()', () => {
  test('title from meta data', () => {
    const src = dd`
    ---
    title: Foo
    ---
    # Bar

    Paragraph
    `
    const workflow = Workflow.parse(src)
    expect(workflow.title).toBe('Foo')
  })

  test('title from document', () => {
    const src = dd`
    # Bar

    Paragraph
    `
    const workflow = Workflow.parse(src)
    expect(workflow.title).toBe('Bar')
  })

  test('title from file path', () => {
    const workflow = Workflow.parse(new VFile({
      path: '/path/to/example.md',
      value: 'Paragraph',
    }))
    expect(workflow.title).toBe('example.md')
  })

  test('fallback to default title', () => {
    const workflow = Workflow.parse('Paragraph')
    expect(workflow.title).toBe('Untitled')
  })

  test('description from introductory text', () => {
    const src = dd`
    Paragraph

    ---

    More

    \`\`\`generate
    name: foo
    model: gpt-4o
    \`\`\`
    `
    const workflow = Workflow.parse(src)
    expect(workflow.description).toBe('Paragraph')
  })
})