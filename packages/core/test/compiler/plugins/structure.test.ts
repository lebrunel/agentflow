import { describe, expect, test } from 'bun:test'
import { unified } from 'unified'
import { selectAll } from 'unist-util-select'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { default as dd } from 'ts-dedent'
import { workflowVisitor, workflowStructure } from '~/compiler/plugins'

import type { Root } from 'mdast'
import type { ActionNode, CompileOptions, PhaseNode } from '~/index'

describe('workflowStructure()', () => {
  function parse(src: string, opts: CompileOptions = {}) {
    const proc = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkMdx)
      .use(workflowVisitor, opts)
      .use(workflowStructure, opts)

    return proc.runSync(proc.parse(src))
  }

  test('handles no actions', () => {
    const ast = parse(dd`
    # title

    Paragraph
    `)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(1)
    expect(ast.children[0].type).toBe('root')
    expect((ast.children[0] as Root).children.length).toBe(2)
    expect(selectAll('phase', ast).length).toBe(0)
  })

  test('actions grouped into phase', () => {
    const ast = parse(dd`
    # title

    Paragraph

    <Mock as="foo" value="foo" />

    Paragraph

    <Mock as="bar" value="bar" />
    `)

    expect(ast.type).toBe('workflow')
    expect(ast.children.length).toBe(2)
    expect(ast.children[0].type).toBe('root')
    expect((ast.children[0] as Root).children.length).toBe(0)
    expect(ast.children[1].type).toBe('phase')
    expect(selectAll('phase', ast).length).toBe(1)
    expect(selectAll('action', ast.children[1]).length).toBe(2)
  })

  test('horizontal lines groups actions into multiple phases', () => {
    const ast = parse(dd`
    Paragraph

    <Mock as="foo" value="foo" />

    ---

    Paragraph

    <Mock as="bar" value="bar" />
    `)

    const phases = selectAll('phase', ast)
    expect(phases.length).toBe(2)
    for (const phase of phases) {
      expect(selectAll('action', phase).length).toBe(1)
    }
  })

  test('first phase without actions treated as intro content', () => {
    const ast = parse(dd`
    Paragraph

    ---

    Paragraph

    <Mock as="bar" value="bar" />
    `)

    expect(ast.children[0].type).toBe('root')
    expect((ast.children[0] as Root).children.length).toBe(1)
    expect(selectAll('phase', ast).length).toBe(1)
  })

  test('handles multiple dividers', () => {
    const ast = parse(dd`
    Paragraph

    ---
    ---
    ---

    Paragraph

    <Mock as="bar" value="bar" />
    `)

    expect(ast.children[0].type).toBe('root')
    expect((ast.children[0] as Root).children.length).toBe(1)
    expect(selectAll('phase', ast).length).toBe(1)
  })

  test('phases have expressions and actions', () => {
    const ast = parse(dd`
    # title

    Paragraph {input}

    <Mock as="foo" value="foo" />

    Paragraph {input}

    <Mock as="bar" value="bar" />
    `)

    expect(selectAll('phase', ast).length).toBe(1)
    expect(selectAll('action', ast).length).toBe(2)
    expect(selectAll('expression', ast).length).toBe(2)
  })

  test('handles nested actions', () => {
    const ast = parse(dd`
    # title

    <Loop as="l">
      Paragraph

      <If as="i">
        <Mock as="foo" value="foo" />
      </If>
    </Loop>
    `)

    expect(ast.children[1].type).toBe('phase')
    const phase1 = ast.children[1] as PhaseNode
    expect(phase1.children[1].type).toBe('action')
    const action1 = phase1.children[1] as ActionNode
    expect(action1.name).toBe('loop')
    expect(action1.children[0].type).toBe('phase')
    const phase2 = action1.children[0] as PhaseNode
    expect(phase2.children[1].type).toBe('action')
    const action2 = phase2.children[1] as ActionNode
    expect(action2.name).toBe('if')
    expect(action2.children[0].type).toBe('phase')
    const phase3 = action2.children[0] as PhaseNode
    expect(phase3.children[0].type).toBe('action')
    const action3 = phase3.children[0] as ActionNode
    expect(action3.name).toBe('mock')
    expect(action3.children.length).toBe(0)
  })

  test('handles nested actions with sub-phases', () => {
    const ast = parse(dd`
    # title

    <Loop as="l">
      Paragraph

      <Mock as="foo" value="foo" />

      ---

      Paragraph

      <Mock as="bar" value="bar" />
    </Loop>
    `)

    const loop = ast.children[1].children[1] as ActionNode
    expect(loop.type).toBe('action')
    expect(loop.name).toBe('loop')
    expect(selectAll('phase', loop).length).toBe(2)
  })
})
