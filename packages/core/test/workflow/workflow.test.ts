import { describe, expect, test } from 'bun:test'
import { u } from 'unist-builder'
import { toString } from 'mdast-util-to-string'
import { VFile } from 'vfile'

import { compileSync, util } from '~/index'

const { dd } = util

describe('Workflow.parse()', () => {
  test('title from meta data', () => {
    const src = dd`
    ---
    title: Foo
    ---

    # Bar

    Paragraph
    `
    const file = compileSync(src)
    const workflow = file.result
    expect(workflow.title).toBe('Foo')
  })

  test('title from document', () => {
    const src = dd`
    # Bar

    Paragraph
    `
    const file = compileSync(src)
    const workflow = file.result
    expect(workflow.title).toBe('Bar')
  })

  test('title from document 2', () => {
    const src = dd`
    # Bar

    Paragraph

    <GenerateText model="openai:gpt-4o" name="foo" />
    `
    const file = compileSync(src)
    const workflow = file.result
    expect(workflow.title).toBe('Bar')
  })

  test('title from file path', () => {
    const file = compileSync(new VFile({
      path: '/path/to/example.md',
      value: 'Paragraph',
    }))
    const workflow = file.result
    expect(workflow.title).toBe('example.md')
  })

  test('fallback to default title', () => {
    const file = compileSync('Paragraph')
    const workflow = file.result
    expect(workflow.title).toBe('Untitled')
  })

  test('description from introductory text', () => {
    const src = dd`
    Paragraph

    ---

    More

    <GenerateText model="openai:gpt-4o" name="foo" />
    `
    const file = compileSync(src)
    const workflow = file.result
    expect(toString(workflow.descriptionNodes)).toBe('Paragraph')
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

    <GenerateText model="openai:gpt-4o" name="name" />
    `
    expect(() => compileSync(src)).toThrow(/duplicate context/i)
  })

  test('actions cannot duplicate previous context', () => {
    const src = dd`
    Paragraph

    <GenerateText model="openai:gpt-4o" name="foo" />

    ---

    Paragraph

    <GenerateText model="openai:gpt-4o" name="foo" />
    `
    expect(() => compileSync(src)).toThrow(/duplicate context/i)
  })

  test('context tags can reference existing context', () => {
    const src = dd`
    ---
    inputs:
      name:
        type: text
    ---

    Paragraph

    <GenerateText model="openai:gpt-4o" name="description" />

    ---

    Paragraph {name}

    Paragraph {description}
    `
    expect(() => compileSync(src)).not.toThrow()
  })

  test('context tags cannot reference future context', () => {
    const src = dd`
    ---
    inputs:
      name:
        type: text
    ---

    Paragraph {name}

    Paragraph {description}

    <GenerateText model="openai:gpt-4o" name="description" />
    `
    expect(() => compileSync(src)).toThrow(/unknown context/i)
  })
})

describe('Phase', () => {
  const src = dd`
  # Sample workflow

  This is an instruction

  <GenerateText model="openai:gpt-4o" name="foo" />

  This is a second instruction

  <GenerateText model="openai:gpt-4o" name="bar" />

  This is a third instruction

  <GenerateText model="openai:gpt-4o" name="qux" />

  Some final text.
  `
  const file = compileSync(src)
  const workflow = file.result

  test('has iterable actions', () => {
    const phase = workflow.phases[0]
    const actions = phase.actions
    expect(actions.length).toBe(3)
    expect(actions.every(a => a.name === 'GenerateText')).toBeTrue()
    expect(actions[0].props.name).toBe('foo')
    expect(actions[1].props.name).toBe('bar')
    expect(actions[2].props.name).toBe('qux')
    expect(phase.trailingNodes.length).toBe(1)
  })
})
