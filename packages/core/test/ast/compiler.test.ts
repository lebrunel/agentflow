import { beforeAll, describe, expect, test } from 'bun:test'
import { VFile } from 'vfile'
import dd from 'ts-dedent'
import { env } from 'test/support/env'
import { createCompiler, compile, compileSync } from 'src/ast'
import { Workflow } from 'src/workflow'
import type { Paragraph, Root, Yaml } from 'mdast'
import type { ActionNode, ExpressionNode } from 'src'
import type { Processor } from 'unified'


describe('createCompiler()', () => {
  let proc: Processor<Root, Root, Root, Root, Workflow>

  beforeAll(() => {
    proc = createCompiler({ env })
  })

  test('returns a unified processer', () => {
    expect(proc.parse).toBeFunction()
    expect(proc.run).toBeFunction()
    expect(proc.runSync).toBeFunction()
    expect(proc.process).toBeFunction()
    expect(proc.processSync).toBeFunction()
  })

  test('parse() parses string raw AST', () => {
    const ast = proc.parse(dd`
    Hello

    World
    `)
    expect(ast.type).toBe('root')
    expect(ast.children).toHaveLength(2)
    ast.children.every(n => expect(n.type).toBe('paragraph'))
  })

  test('runSync() caputures frontmatter', () => {
    const ast = proc.runSync(proc.parse(dd`
    ---
    data:
      foo: bar
    ---
    Hello
    `))
    expect(ast.children[0].type).toBe('yaml')
    expect((ast.children[0] as Yaml).value).toBeTypeOf('string')
    expect((ast.children[0] as Yaml).data).toEqual({ data: { foo: 'bar' }})
  })

  test('runSync() strips comment nodes', () => {
    const ast = proc.runSync(proc.parse(dd`
    > This is a comment

    Hello

    > This is another comment

    World
    `))
    expect(ast.children).toHaveLength(2)
    ast.children.every(n => expect(n.type).toBe('paragraph'))
  })

  test('runSync() converts mdx flow elements to actions', () => {
    const ast = proc.runSync(proc.parse(dd`
    Hello

    <Mock as="foo" value="bar" />
    `))
    expect(ast.children[1].type).toBe('action')
    expect((ast.children[1] as ActionNode).name).toBe('mock')
    expect((ast.children[1] as ActionNode).attributes.as).toBe('foo')
    expect((ast.children[1] as ActionNode).attributes.value).toBe('bar')
  })

  test('runSync() throws error on mdx text elements', () => {
    expect(() => {
      proc.runSync(proc.parse('Hello <Mock as="foo" value="bar" />'))
    }).toThrow(/action must be a block-level/i)
  })

  test('runSync() converts mdx flow expressions to expressions', () => {
    const ast = proc.runSync(proc.parse(dd`
    Hello

    {'world'}
    `))
    expect(ast.children[1].type).toBe('expression')
    expect((ast.children[1] as ExpressionNode).expressionType).toBe('flow')
    expect((ast.children[1] as ExpressionNode).value).toBe("'world'")
  })

  test('runSync() converts mdx text expressions to expressions', () => {
    const ast = proc.runSync(proc.parse(`Hello {'world'}`))
    const para = ast.children[0] as Paragraph
    expect(para.children[1].type).toBe('expression')
    expect((para.children[1] as ExpressionNode).expressionType).toBe('text')
    expect((para.children[1] as ExpressionNode).value).toBe("'world'")
  })

  test('runSync() converts attribute expressions to expressions', () => {
    const ast = proc.runSync(proc.parse(`<Mock as="foo" value={'world'} />`))
    const attr = (ast.children[0] as ActionNode).attributes.value
    expect(attr.type).toBe('expression')
    expect(attr.expressionType).toBe('attribute')
    expect(attr.value).toBe("'world'")
  })

  test('runSync() throws on splat expressions', () => {
    expect(() => {
      proc.runSync(proc.parse('<Mock as="foo" {...attrs} />'))
    }).toThrow(/unsupported attribute syntax/i)
  })

  test('processSync() compile to VFile with workflow', () => {
    const file = proc.processSync(`Hello {'world'}`)
    expect(file).toBeInstanceOf(VFile)
    expect(file.result).toBeInstanceOf(Workflow)
  })

  test('processSync() throws on invalid workflow', () => {
    expect(() => {
      proc.processSync(dd`
      Hello {name}

      <GenText as="name" model="openai:gpt-4o" />
      `)
    }).toThrow(/unknown context "name"/i)
  })
})

describe('compile()', () => {
  test('returns an async VFile', () => {
    expect(compile('Test', { env })).resolves.toBeInstanceOf(VFile)
  })
})

describe('compileSync()', () => {
  test('returns a VFile', () => {
    expect(compileSync('Test', { env })).toBeInstanceOf(VFile)
  })
})
