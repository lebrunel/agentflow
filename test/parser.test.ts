import { beforeAll, describe, expect, test } from 'bun:test'
import { default as dd } from 'ts-dedent'
import { parseProcessor } from '../src/parser'
import type { FlowContextNode, FlowGenerateNode, FlowRootNode, FlowRoutineNode } from '../src/ast'
import { VFile } from 'vfile'
import { visit } from 'unist-util-visit'

describe('parseProcessor() parses metadata', () => {
  function parse(src: string): VFile {
    const proc = parseProcessor()
    const file = new VFile({
      path: '/path/to/example.md',
      value: src,
    })
    return proc.processSync(file)
  }

  test('yaml, title from yaml', () => {
    const file = parse(dd`
    ---
    title: Title 1
    foo: bar
    ---

    # Title 2

    This is a paragraph.
    
    \`\`\`generate
    name: foo
    \`\`\`
    
    `)

    expect(file.data.title).toBe('Title 1')
    expect(file.data.matter).toEqual({ title: 'Title 1', foo: 'bar' })
  })

  test('title from document', () => {
    const file = parse(dd`
    # Title 2

    This is a paragraph.
    
    \`\`\`generate
    name: foo
    \`\`\`
    
    `)

    expect(file.data.title).toBe('Title 2')
    expect(file.data.matter).toEqual({})
  })

  test('title from filename', () => {
    const file = parse(dd`
    This is a paragraph.
    
    \`\`\`generate
    name: foo
    \`\`\`
    
    `)

    expect(file.data.title).toBe('example')
    expect(file.data.matter).toEqual({})
  })
})

describe('parseProcessor() parses routines', () => {
  function parse(src: string): FlowRootNode {
    const proc = parseProcessor()
    return proc.runSync(proc.parse(src))
  }

  test('no routines, all direct children', () => {
    const ast = parse(dd`
    # Introduction

    This is a paragraph.

    ## Section 1

    Another paragraph here.

    ## Section 2

    Final paragraph.
    `)

    expect(ast.type).toBe('flow-root')
    expect(ast.children.length).toEqual(6)
    expect(ast.children.every(child => child.type !== 'flow-routine')).toBe(true)
  })

  test('1 routine at the end', () => {
    const ast = parse(dd`
    # Main Title

    Some text here.

    ## First Section

    More text.

    ## Second Section

    Even more text.

    \`\`\`generate
    name: foo
    \`\`\`
    `)
  
    expect(ast.type).toBe('flow-root')
    expect(ast.children.length).toBe(5)
    expect(ast.children[4].type).toBe('flow-routine')
    expect((ast.children[4] as FlowRoutineNode).children.length).toBe(3)
  })

  test('2 routines, first routine starts at h2', () => {
    const ast = parse(dd`
    # Overview

    Introduction paragraph.

    ## Details

    Some details here.

    \`\`\`generate
    name: foo1
    \`\`\`

    ## Conclusion

    Wrapping up.

    \`\`\`generate
    name: foo2
    \`\`\`
    `)
  
    expect(ast.type).toBe('flow-root')
    expect(ast.children.length).toBe(4)
    expect(ast.children.filter(n => n.type === 'flow-routine')).toHaveLength(2)
  })

  test('yaml, 2 routines starting at first h2', () => {
    const ast = parse(dd`
    ---
    title: Test Document
    ---

    # Introduction

    Opening remarks.

    ## Technical Details

    \`\`\`generate
    name: foo
    \`\`\`

    ## Summary

    Concluding paragraph.
    `);
  
    expect(ast.type).toBe('flow-root')
    expect(ast.children.length).toBe(5)
    expect(ast.children[0].type).toBe('yaml')
    expect(ast.children.filter(n => n.type === 'flow-routine')).toHaveLength(2)
  })
  
})

describe('parseProcessor() parses context tags and generate blocks', () => {
  const src = dd`
  ---
  input:
    - name: foo
      description: bar
      type: string
  ---

  # Overview

  Introduction paragraph.

  \`@foo\`

  \`\`\`generate
  name: foo1
  \`\`\`

  ## Conclusion

  Wrapping up.

  \`@foo\`

  \`\`\`generate
  name: foo2
  \`\`\`
  `

  const proc = parseProcessor()
  const ast = proc.runSync(proc.parse(src))

  test('finds all context tags', () => {
    const contextNodes: FlowContextNode[] = []
    visit(ast, 'flow-context', (n) => {
      contextNodes.push(n)
    })

    expect(contextNodes).toHaveLength(2)
    expect(contextNodes.every(n => n.value === '@foo')).toBeTrue()
  })

  test('finds all context tags', () => {
    const generateNodes: FlowGenerateNode[] = []
    visit(ast, 'flow-generate', (n) => {
      generateNodes.push(n)
    })

    expect(generateNodes).toHaveLength(2)
    expect(generateNodes[0].value).toBe('name: foo1')
    expect(generateNodes[1].value).toBe('name: foo2')
  })
})