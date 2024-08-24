import { describe, expect, test } from 'bun:test'
import { selectAll } from 'unist-util-select'
import type { Root } from 'mdast'

import { createProcessor, util } from '~/index'
import type { ActionNode, ExpressionNode, PhaseNode, WorkflowNode } from '~/workflow/compiler'

const { dd } = util
const proc = createProcessor()

function parse(src: string) {
  return proc.runSync(proc.parse(src))
}

describe('compileProcessor()', () => {
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
