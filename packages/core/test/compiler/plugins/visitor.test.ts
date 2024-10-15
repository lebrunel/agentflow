import { describe, expect, test } from 'bun:test'
import { runtime } from 'test/support/runtime'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { selectAll } from 'unist-util-select'
import { parse } from 'acorn'
import { dedent as dd } from 'ts-dedent'
import { VFile } from 'vfile'
import type { Program } from 'estree-jsx'
import type { Paragraph } from 'mdast'

import { workflowVisitor, validateEstree } from 'src/compiler/plugins/visitor'
import type { ActionNode, CompileOptions } from 'src/index'

describe('workflowVisitor()', () => {
  function parse(src: string, opts: CompileOptions = {}) {
    const proc = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkMdx)
      .use(workflowVisitor, opts)

    return proc.runSync(proc.parse(src))
  }

  test('parses yaml frontmatter', () => {
    const ast = parse(dd`
    ---
    foo: bar
    inputs:
      name:
        type: 'text'
    ---

    Testing
    `)

    expect(ast.children[0].type).toBe('yaml')
    const data = ast.children[0].data as any
    expect(data.foo).toBe('bar')
    expect(data.inputs).toEqual({ name: { type: 'text' } })
  })

  test('throws error with invalid input schema', () => {
    const src = dd`
    ---
    inputs:
      foo: 123
    ---

    Testing
    `

    expect(() => parse(src)).toThrow(/invalid input schema/i)
  })

  test('throws error with invalid yaml', () => {
    const src = dd`
    ---
    **
    ---

    Testing
    `

    expect(() => parse(src)).toThrow()
  })

  test('strips all blockquote blocks from the AST', () => {
    const ast = parse(dd`
    # Title

    A paragraph

    > A comment block

    Another paragraph

    <GenText as="foo" model="openai:gpt-4o" />

    <Loop as="loop" until={$index === 5}>
      > A nested comment block

      <GenText as="bar" model="openai:gpt-4o" />
    </Loop>
    `)

    const loopNode = ast.children[ast.children.length - 1] as ActionNode
    expect(ast.children).toHaveLength(5)
    expect(loopNode.children).toHaveLength(1)
    expect(selectAll('blockquote', ast)).toHaveLength(0)
  })

  describe('handle actions', () => {
    test('parses actions', () => {
      const ast = parse(`<Mock foo="bar" />`)

      const node = ast.children[0] as any
      expect(node.type).toBe('action')
      expect(node.name).toBe('mock')
      expect(node.attributes).toEqual({ foo: 'bar' })
    })

    test('kebab-cases action names', () => {
      const ast = parse(`<FooBar />`)

      const node = ast.children[0] as any
      expect(node.type).toBe('action')
      expect(node.name).toBe('foo-bar')
    })

    test('camel-cases prop names', () => {
      const ast = parse(dd`
      <Mock foo="bar" foo-bar="bar" FooQux="bar" />
      `)

      const node = ast.children[0] as any
      expect(node.type).toBe('action')
      expect(Object.keys(node.attributes)).toEqual(['foo', 'fooBar', 'fooQux'])
    })

    test('props can be expressions', () => {
      const ast = parse(`<Mock foo={123} />`)

      const node = ast.children[0] as any
      expect(node.type).toBe('action')
      expect(node.attributes.foo.type).toBe('expression')
      expect(node.attributes.foo.data.estree.type).toBe('Program')
    })

    test('throws error with invalid expression', () => {
      const src = `<Mock foo={eval('bad things')} />`
      expect(() => parse(src)).toThrow()
    })

    test('throws error with invalid props (rest operator)', () => {
      const src = `<Mock {...props} />`
      expect(() => parse(src)).toThrow()
    })

    test('throws error with inline actions', () => {
      const src = `Testing <Mock foo="bar" />`
      expect(() => parse(src)).toThrow(/must be a block-level/i)
    })
  })

  describe('handle actions with runtime', () => {
    test('props can be expressions', () => {
      const ast = parse(dd`
      <Mock as="foo" value={"bar"} />
      `, { runtime })

      const node = ast.children[0] as any
      expect(node.type).toBe('action')
      expect(node.attributes.value.type).toBe('expression')
      expect(node.attributes.value.data.estree.type).toBe('Program')
    })

    test('throws error with unknown action', () => {
      const src = `<FooBar as="foo" value="bar" />`
      expect(() => parse(src, { runtime })).toThrow(/unknown action/i)
    })

    test('throws error if action props invalie', () => {
      const src = `<Mock as="foo" />`
      expect(() => parse(src, { runtime })).toThrow(/invalid action attributes/i)
    })
  })

  test('parses expressions', () => {
    const ast = parse(dd`
    {'block expression'}

    Testing: {'text expression'}
    `)

    expect(ast.children[0].type).toBe('paragraph')
    expect((ast.children[0] as Paragraph).children[0].type).toBe('expression')
    expect(ast.children[1].type).toBe('paragraph')
    expect((ast.children[1] as Paragraph).children[1].type).toBe('expression')
  })

  test('throws error with invalid expression', () => {
    const src = `{eval('bad things')}`
    expect(() => parse(src)).toThrow()
  })
})

describe('validateEstree()', () => {
  function testValidation(input: string, shouldPass: boolean) {
    const ast = parse(input, { ecmaVersion: 'latest', sourceType: 'module' })
    const validate = () => validateEstree(ast as Program, new VFile())
    if (shouldPass) {
      expect(validate).not.toThrow()
    } else {
      expect(validate).toThrow()
    }
  }

  test('valid simple expression', () => {
    testValidation('1 + 2', true)
  })

  test('valid object and array literals', () => {
    testValidation('({ a: 1, b: [1, 2, 3] })', true)
  })

  test('valid function expression', () => {
    testValidation('(function() { return 42; })', true)
  })

  test('valid arrow function', () => {
    testValidation('(x => x * 2)', true)
  })

  test('valid ternary operator', () => {
    testValidation('true ? 1 : 0', true)
  })

  test('valid template literal', () => {
    testValidation('`Hello, ${name}!`', true)
  })

  test('invalid class declaration', () => {
    testValidation('class MyClass {}', false)
  })

  test('invalid function declaration', () => {
    testValidation('function myFunction() {}', false)
  })

  test('invalid import statement', () => {
    testValidation('import { foo } from "bar";', false)
  })

  test('invalid export statement', () => {
    testValidation('export const x = 5;', false)
  })

  test('invalid require call', () => {
    testValidation('const fs = require("fs");', false)
  })

  test('invalid async function expression', () => {
    testValidation('(async () => {})()', false)
  })

  test('invalid for loop', () => {
    testValidation('for (let i = 0; i < 10; i++) {}', false)
  })

  test('invalid while loop', () => {
    testValidation('while (true) {}', false)
  })

  test('invalid try-catch', () => {
    testValidation('try { something(); } catch (e) {}', false)
  })

  test('invalid use of blacklisted identifier', () => {
    testValidation('eval("1 + 1")', false)
  })

  test('invalid use of global object', () => {
    testValidation('window.location', false)
  })

  test('invalid use of setTimeout', () => {
    testValidation('setTimeout(() => {}, 1000)', false)
  })

  test('invalid use of Promise constructor', () => {
    testValidation('new Promise((resolve, reject) => {})', false)
  })
})
