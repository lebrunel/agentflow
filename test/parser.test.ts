import { describe, expect, test } from 'bun:test'
import { default as dd } from 'ts-dedent'
import { selectAll } from 'unist-util-select'
import type { Root } from 'mdast'
import { parseProcessor } from '../src/parser'
import type { ActionNode, ContextNode, PhaseNode, WorkflowNode } from '../src/ast'

function parse(src: string): WorkflowNode {
  const proc = parseProcessor()
  return proc.runSync(proc.parse(src))
}

describe('parseProcessor()', () => {
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

    \`\`\`generate
    name: foo
    \`\`\`
    `
    const ast = parse(src)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(1)
    expect(ast.children[0].type).toBe('phase')
    expect((ast.children[0] as PhaseNode).children.length).toBe(5)
  })

  test('handles single phase with intro', () => {
    const src = dd`
    # Introduction

    This is a paragraph.

    ---

    ## Section 1

    Another paragraph here.

    \`\`\`generate
    name: foo
    \`\`\`
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

    \`\`\`generate
    name: foo
    \`\`\`

    ---

    ## Section 2

    Another paragraph here.

    \`\`\`generate
    name: bar
    \`\`\`
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

    \`\`\`generate
    name: foo
    \`\`\`

    ---

    ## Section 2

    Another paragraph here.

    \`\`\`generate
    name: bar
    \`\`\`
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

    \`\`\`generate
    name: foo
    \`\`\`
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
    input:
      - name: foo
      - name: bar
    ---
    # Introduction

    This is a paragraph.

    ## Section 1

    Another paragraph here.

    \`@foo\`

    \`\`\`generate
    name: res1
    \`\`\`

    \`@bar\`

    \`\`\`generate
    name: res2
    \`\`\`
    `
    const ast = parse(src)
    const contexts = selectAll('context', ast) as ContextNode[]
    const actions = selectAll('action', ast) as ActionNode[]

    expect(contexts.length).toBe(2)
    expect(contexts.map(n => n.value)).toEqual(['foo', 'bar'])
    expect(actions.length).toBe(2)
  })
})
