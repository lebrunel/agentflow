import { describe, expect, test } from 'bun:test'
import { selectAll } from 'unist-util-select'
import { toString } from 'mdast-util-to-string'
import { default as dd } from 'ts-dedent'
import { VFile } from 'vfile'
import { compileSync, createProcessor, Runtime } from '~/index'

import type { Root } from 'mdast'
import type { ActionNode, ExpressionNode, PhaseNode } from '~/index'

describe('Parser', () => {
  function parse(src: string) {
    const proc = createProcessor()
    return proc.runSync(proc.parse(src))
  }

  test('handles no phases', () => {
    const src = dd`
    # Introduction

    This is a paragraph.

    ## Section 1

    Another paragraph here.

    ## Section 2

    Final paragraph.
    `
    const ast = parse(src)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(1)
    expect(ast.children[0].type).toBe('root')
    expect((ast.children[0] as Root).children.length).toBe(6)
    expect(selectAll('phase', ast).length).toBe(0)
  })

  test('handles single phase', () => {
    const src = dd`
    # Introduction

    This is a paragraph.

    ## Section 1

    Another paragraph here.

    <GenerateText as="foo" model="openai:gpt-4o" />
    `
    const ast = parse(src)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(2)
    expect(ast.children[0].type).toBe('root')
    expect((ast.children[0] as PhaseNode).children.length).toBe(0)
    expect(ast.children[1].type).toBe('phase')
    expect((ast.children[1] as PhaseNode).children.length).toBe(5)
  })

  test('handles single phase with intro', () => {
    const src = dd`
    # Introduction

    This is a paragraph.

    ---

    ## Section 1

    Another paragraph here.

    <GenerateText as="foo" model="openai:gpt-4o" />
    `
    const ast = parse(src)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(2)
    expect(ast.children[0].type).toBe('root')
    expect((ast.children[0] as Root).children.length).toBe(2)
    expect(ast.children[1].type).toBe('phase')
    expect((ast.children[1] as PhaseNode).children.length).toBe(3)
  })

  test('handles multiple phases', () => {
    const src = dd`
    # Introduction

    This is a paragraph.

    ---

    ## Section 1

    Another paragraph here.

    <GenerateText as="foo" model="openai:gpt-4o" />

    ---

    ## Section 2

    Another paragraph here.

    <GenerateText as="foo" model="openai:gpt-4o" />
    `
    const ast = parse(src)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(3)
    expect(ast.children[0].type).toBe('root')

    const phases = selectAll('phase', ast) as PhaseNode[]
    expect(phases.length).toBe(2)
    expect(phases.every(n => n.children.length === 3)).toBeTrue()
  })

  test('handles multiple phases with frontmatter', () => {
    const src = dd`
    ---
    foo: bar
    ---

    # Introduction

    This is a paragraph.

    ---

    ## Section 1

    Another paragraph here.

    <GenerateText as="foo" model="openai:gpt-4o" />

    ---

    ## Section 2

    Another paragraph here.

    <GenerateText as="bar" model="openai:gpt-4o" />
    `
    const ast = parse(src)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(3)
    expect(ast.children[0].type).toBe('root')
    expect(ast.children[0].children.length).toBe(3)
    expect(selectAll('phase', ast).length).toBe(2)
  })

  test('handles multiple dividers', () => {
    const src = dd`
    # Introduction

    This is a paragraph.

    ---
    ---
    ---

    ## Section 1

    Another paragraph here.

    <GenerateText as="foo" model="openai:gpt-4o" />
    `
    const ast = parse(src)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(2)
    expect(ast.children[0].type).toBe('root')
    expect(ast.children[0].children.length).toBe(2)
    expect(ast.children[1].type).toBe('phase')
    expect(ast.children[1].children.length).toBe(3)
  })

  test('parses context tags and action blocks', () => {
    const src = dd`
    ---
    inputs:
      foo:
        type: text
      bar:
        type: text
    ---
    # Introduction

    This is a paragraph.

    ## Section 1

    Another paragraph here.

    {foo}

    <GenerateText as="r1" model="openai:gpt-4o" />

    {bar}

    <GenerateText as="r2" model="openai:gpt-4o" />
    `
    const ast = parse(src)
    const contexts = selectAll('expression', ast) as ExpressionNode[]
    const actions = selectAll('action', ast) as ActionNode[]

    expect(contexts.length).toBe(2)
    expect(actions.length).toBe(2)
  })
})

describe('Compiler', () => {
  function compile(src: string) {
    const file = compileSync(src)
    return file.result
  }

  test('title from meta data', () => {
    const src = dd`
    ---
    title: Foo
    ---

    # Bar

    Paragraph
    `
    const workflow = compile(src)
    expect(workflow.title).toBe('Foo')
  })

  test('title from document', () => {
    const src = dd`
    # Bar

    Paragraph
    `
    const workflow = compile(src)
    expect(workflow.title).toBe('Bar')
  })

  test('title from document 2', () => {
    const src = dd`
    # Bar

    Paragraph

    <GenerateText as="foo" model="openai:gpt-4o" />
    `
    const workflow = compile(src)
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

    <GenerateText as="foo" model="openai:gpt-4o" />
    `
    const workflow = compile(src)
    expect(toString(workflow.descriptionNodes)).toBe('Paragraph')
  })

  describe('validations', () => {
    const runtime = new Runtime()

    test('actions must be registered', () => {
      const src = dd`
      Paragraph

      <NotAnAction as="foo" model="openai:gpt-4o" />
      `
      expect(() => compileSync(src, { runtime })).toThrow(/unknown action/i)
    })

    test('actions must be valid', () => {
      const src = dd`
      Paragraph

      <GenerateText props="totally-invalid" />
      `
      expect(() => compileSync(src, { runtime })).toThrow(/invalid action/i)
    })

    test('actions cannot duplicate input context', () => {
      const src = dd`
      ---
      inputs:
        foo:
          type: text
      ---

      Paragraph

      <GenerateText as="foo" model="openai:gpt-4o" />
      `
      expect(() => compileSync(src)).toThrow(/duplicate context/i)
    })

    test('actions cannot duplicate previous context', () => {
      const src = dd`
      Paragraph

      <GenerateText as="foo" model="openai:gpt-4o" />

      ---

      Paragraph

      <GenerateText as="foo" model="openai:gpt-4o" />
      `
      expect(() => compileSync(src)).toThrow(/duplicate context/i)
    })

    test('expressions can reference existing context', () => {
      const src = dd`
      ---
      inputs:
        name:
          type: text
      ---

      Paragraph

      <GenerateText as="description" model="openai:gpt-4o" />

      ---

      Paragraph {name}

      Paragraph {description}
      `
      expect(() => compileSync(src)).not.toThrow()
    })

    test('expressions cannot reference future context', () => {
      const src = dd`
      ---
      inputs:
        name:
          type: text
      ---

      Paragraph {name}

      Paragraph {description}

      <GenerateText as="description" model="openai:gpt-4o" />
      `
      expect(() => compileSync(src)).toThrow(/unknown context/i)
    })

    test.skip('actions must not contain invalid statements', () => {
      const src = dd`
      Paragraph

      <GenerateText as="description" model="openai:gpt-4o" />

      {() => 'break'}
      `
      expect(() => compileSync(src)).toThrow(/invalid expression/i)
    })
  })

  describe('WorkflowPhase', () => {
    const src = dd`
    # Sample workflow

    This is an instruction

    <GenerateText as="foo" model="openai:gpt-4o" />

    This is a second instruction

    <GenerateText as="bar" model="openai:gpt-4o" />

    This is a third instruction

    <GenerateText as="qux" model="openai:gpt-4o" />

    Some final text.
    `
    const file = compileSync(src)
    const workflow = file.result

    test('has iterable actions', () => {
      const phase = workflow.phases[0]
      const actions = phase.actions
      expect(actions.length).toBe(3)
      expect(actions.every(a => a.name === 'GenerateText')).toBeTrue()
      expect(actions[0].contextKey).toBe('foo')
      expect(actions[1].contextKey).toBe('bar')
      expect(actions[2].contextKey).toBe('qux')
      expect(phase.trailingNodes.length).toBe(1)
    })
  })
})
