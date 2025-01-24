import { describe, expect, test } from 'bun:test'
import { parse } from 'acorn'
import { VFile } from 'vfile'
import {
  validateProgram,
  validateNodeWhitelist,
  validateIdentifierBlacklist,
  validateAsyncFunctions,
  visitor,
} from 'src/ast'

describe('ES validator visitors', () => {
  function validate(src: string) {
    const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
    visitor(ast, new VFile())
      .on('es:enter', validateProgram)
      .on('es:enter', validateNodeWhitelist)
      .on('es:enter', validateIdentifierBlacklist)
      .on('es:enter', validateAsyncFunctions)
      .visit()
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
