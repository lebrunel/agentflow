import { describe, expect, test } from 'bun:test'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { selectAll } from 'unist-util-select'
import { parse } from 'acorn'
import { default as dd } from 'ts-dedent'
import { VFile } from 'vfile'
import { workflowVisitor, validateEstree } from '~/compiler/plugins/visitor'

import type { Program } from 'estree-jsx'
import type { ActionNode } from '~/index'

describe('workflowVisitor()', () => {
  function parse(src: string) {
    const proc = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkMdx)
      .use(workflowVisitor, {})

    return proc.runSync(proc.parse(src))
  }

  test.todo('parses yaml frontmatter')
  test.todo('throws error with invalid input schema')
  test.todo('throws error with invalid yaml')

  test('strips all blockquote blocks from the AST', () => {
    const ast = parse(dd`
    # Title

    A paragraph

    > A comment block

    Another paragraph

    <GenerateText as="foo" model="openai:gpt-4o" />

    <Loop as="loop" until={$index === 5}>
      > A nested comment block

      <GenerateText as="bar" model="openai:gpt-4o" />
    </Loop>
    `)

    const loopNode = ast.children[ast.children.length - 1] as ActionNode
    expect(ast.children).toHaveLength(5)
    expect(loopNode.children).toHaveLength(1)
    expect(selectAll('blockquote', ast)).toHaveLength(0)
  })

  describe('handle actions', () => {
    test.todo('parses actions') // as action node
    test.todo('kebab-cases action names')
    test.todo('camel-cases prop names')
    test.todo('props can be expressions')
    test.todo('throws error with invalid expression')
    test.todo('throws error with invalid props (rest operator)')
    test.todo('throws error with inline actions')
  })

  describe('handle actions with runtime', () => {
    test.todo('throws error with unknown action')
    test.todo('throws error if action props invalie')
    test.todo('props can be expressions')
  })

  test.todo('parses expressions')
  test.todo('block expressions get treated as text') // wrapped in paragrph node
  test.todo('throws error with invalid expression')
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
