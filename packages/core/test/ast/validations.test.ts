import { describe, expect, test } from 'bun:test'
import { u } from 'unist-builder'
import { parse } from 'acorn'
import { VFile } from 'vfile'
import { compileSync, validateDependency, validateEstree, validateUniqueness } from 'src/ast'
import dd from 'ts-dedent'

import type { Program } from 'estree-jsx'

describe('validateWorkflow()', () => {
  function validate(src: string) {
    compileSync(src) // calls validateWorkflow internally
  }

  test('accepts workflow with unique inputs and action keys', () => {
    const src = dd`
    ---
    data:
      foo: 1
    input:
      bar: 1
    ---

    Hello

    <Mock as="qux" value="test" />
    `

    expect(() => validate(src)).not.toThrow()
  })

  test('throws on duplicating inputs', () => {
    const src1 = dd`
    ---
    data:
      foo: 1
      foo: 1
    ---

    Hello
    `
    const src2 = dd`
    ---
    data:
      foo: 1
    input:
      foo: 1
    ---

    Hello
    `

    expect(() => validate(src1)).toThrow(/Map keys must be unique/)
    expect(() => validate(src2)).toThrow(/Duplicate context name "foo"/)
  })

  test('throws on action keys duplicating with inputs', () => {
    const src = dd`
    ---
    data:
      foo: 1
    ---

    Hello

    <Mock as="foo" value="test" />
    `

    expect(() => validate(src)).toThrow(/Duplicate context name "foo"/)
  })

  test('throws on duplicating action keys', () => {
    const src = dd`
    Hello

    <Mock as="foo" value="test" />

    World

    <Mock as="foo" value="test" />
    `

    expect(() => validate(src)).toThrow(/Duplicate context name "foo"/)
  })

  test('throws on cross-phase duplicating action keys', () => {
    const src = dd`
    Hello

    <Mock as="foo" value="test" />

    ---

    World

    <Mock as="foo" value="test" />
    `

    expect(() => validate(src)).toThrow(/Duplicate context name "foo"/)
  })

  test('accepts re-used keys across scopes', () => {
    const src = dd`
    Hello

    <Mock as="foo" value="test" />

    <Loop as="loop" until={$.index === 2}>
      World

      <Mock as="foo" value="test" />
    </Loop>
    `

    expect(() => validate(src)).not.toThrow()
  })

  test('throws on action keys duplicating with provided', () => {
    const src = dd`
    <Loop as="loop" until={$.index === 2} provide={{ foo: 'test' }}>
      World

      <Mock as="foo" value="test" />
    </Loop>
    `

    expect(() => validate(src)).toThrow(/Duplicate context name "foo"/)
  })

  // for these do both flow and attribute expressions
  test('accepts expressions with met dependencies', () => {
    const src = dd`
    ---
    data:
      foo: 1
    ---
    Hello {foo}

    <Loop as="loop" until={$.index === 2} provide={{ foo, bar: foo+1 }}>
      World {foo} {bar}
    </Loop>
    `

    expect(() => validate(src)).not.toThrow()
  })

  test('throws on expressions without met dependencies', () => {
    const src1 = dd`
    Hello {foo}
    `

    const src2 = dd`
    <Loop as="loop" until={$.index === 2} provide={{ bar: foo }}>
      Hello {bar}
    </Loop>
    `

    expect(() => validate(src1)).toThrow(/Unknown context "foo"/)
    expect(() => validate(src2)).toThrow(/Unknown context "foo"/)
  })
})

describe('validateDependency()', () => {
  function validate(key: string, set: Set<string>, namespace?: string) {
    validateDependency(key, set, { node: u('test'), file: new VFile(), namespace })
  }

  test('accepts existing contextKey', () => {
    expect(() => validate('foo', new Set(['foo', 'bar']))).not.toThrow()
  })

  test('throws without existing contextKey', () => {
    expect(() => validate('foo', new Set(['bar', 'baz']))).toThrow()
  })

  test('accepts $ helper', () => {
    expect(() => validate('$', new Set(['foo', 'bar']))).not.toThrow()
  })

  test('accepts $namespace helper if given in options', () => {
    expect(() => validate('$test', new Set(['foo', 'bar']))).toThrow()
    expect(() => validate('$test', new Set(['foo', 'bar']), 'test')).not.toThrow()
  })
})

describe('validateEstree()', () => {
  function validate(src: string) {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    validateEstree(ast as Program, new VFile())
  }

  test('accepts simple expression', () => {
    expect(() => validate('1 + 2')).not.toThrow()
  })

  test('accepts object and array literals', () => {
    expect(() => validate('({ a: 1, b: [1, 2, 3] })')).not.toThrow()
  })

  test('accepts function expression', () => {
    expect(() => validate('(function() { return 42; })')).not.toThrow()
  })

  test('accepts arrow function', () => {
    expect(() => validate('(x => x * 2)')).not.toThrow()
  })

  test('accepts ternary operator', () => {
    expect(() => validate('true ? 1 : 0')).not.toThrow()
  })

  test('accepts template literal', () => {
    expect(() => validate('`Hello, ${name}!`')).not.toThrow()
  })

  test('throws on class declaration', () => {
    expect(() => validate('class MyClass {}')).toThrow()
  })

  test('throws on function declaration', () => {
    expect(() => validate('function myFunction() {}')).toThrow()
  })

  test('throws on import statement', () => {
    expect(() => validate('import { foo } from "bar";')).toThrow()
  })

  test('throws on export statement', () => {
    expect(() => validate('export const x = 5;')).toThrow()
  })

  test('throws on require call', () => {
    expect(() => validate('const fs = require("fs");')).toThrow()
  })

  test('throws on async function expression', () => {
    expect(() => validate('(async () => {})()')).toThrow()
  })

  test('throws on for loop', () => {
    expect(() => validate('for (let i = 0; i < 10; i++) {}')).toThrow()
  })

  test('throws on while loop', () => {
    expect(() => validate('while (true) {}')).toThrow()
  })

  test('throws on try-catch', () => {
    expect(() => validate('try { something(); } catch (e) {}')).toThrow()
  })

  test('throws on use of blacklisted identifier', () => {
    expect(() => validate('eval("1 + 1")')).toThrow()
  })

  test('throws on use of global object', () => {
    expect(() => validate('window.location')).toThrow()
  })

  test('throws on use of setTimeout', () => {
    expect(() => validate('setTimeout(() => {}, 1000)')).toThrow()
  })

  test('throws on use of Promise constructor', () => {
    expect(() => validate('new Promise((resolve, reject) => {})')).toThrow()
  })
})

describe('validateUniqueness()', () => {
  function validate(key: string, set: Set<string>) {
    validateUniqueness(key, set, { node: u('test'), file: new VFile() })
  }

  test('accepts unique contextKey', () => {
    expect(() => validate('foo', new Set(['bar', 'baz']))).not.toThrow()
  })

  test('throws on duplicate contextKey', () => {
    expect(() => validate('foo', new Set(['foo', 'bar']))).toThrow()
  })
})
