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

    <GenerateText model="openai:gpt-4o" name="foo" />
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

    <GenerateText model="openai:gpt-4o" name="foo" />
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

    <GenerateText model="openai:gpt-4o" name="foo" />

    ---

    ## Section 2

    Another paragraph here.

    <GenerateText model="openai:gpt-4o" name="foo" />
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

    <GenerateText model="openai:gpt-4o" name="foo" />

    ---

    ## Section 2

    Another paragraph here.

    <GenerateText model="openai:gpt-4o" name="bar" />
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

    <GenerateText model="openai:gpt-4o" name="foo" />
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

    <GenerateText model="openai:gpt-4o" name="res1" />

    {bar}

    <GenerateText model="openai:gpt-4o" name="res2" />
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

    <GenerateText model="openai:gpt-4o" name="foo" />
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

    <GenerateText model="openai:gpt-4o" name="foo" />
    `
    const workflow = compile(src)
    expect(toString(workflow.descriptionNodes)).toBe('Paragraph')
  })

  describe('validations', () => {
    const runtime = new Runtime()

    test('actions must be registered', () => {
      const src = dd`
      Paragraph

      <NotAnAction model="openai:gpt-4o" name="name" />
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

    test('expressions can reference existing context', () => {
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

    test('expressions cannot reference future context', () => {
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

    test.skip('actions must not contain invalid statements', () => {
      const src = dd`
      Paragraph

      <GenerateText model="openai:gpt-4o" name="description" />

      {() => 'break'}
      `
      expect(() => compileSync(src)).toThrow(/invalid expression/i)
    })
  })

  describe('WorkflowPhase', () => {
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
})
