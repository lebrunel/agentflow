import { describe, expect, test } from 'bun:test'
import dd from 'ts-dedent'
import { env } from 'test/support/env'
import { createCompiler, stringify } from 'src/ast'
import { createDynamicEvaluator } from 'src/exec'

import type { Root } from 'mdast'

const evalExpression = createDynamicEvaluator(env)

function parse(markdown: string): Root {
  const proc = createCompiler(env)
  return proc.runSync(proc.parse(markdown))
}

describe('stringify()', () => {
  test('stringifies as source', () => {
    const tests = [
      'Foo {bar}',
      'One {1}, two {1 + 1}, three {4 - 1}',
      dd`
      - foo
      - { ['bar', 'qux'].join('\\n- ') }
      `
    ]

    for (const src of tests) {
      const str = stringify(parse(src))
      expect(str).toBe(src)
    }
  })
})

describe('stringify() with eval function', () => {
  test('handles expression with context', () => {
    const src = `Foo {bar}`
    const str = stringify(parse(src), {
      evaluate: (node) => evalExpression(node, { bar: 'qux' })
    })

    expect(str).toBe('Foo qux')
  })

  test('handles paragraph with multiple expressions', () => {
    const src = `One {1}, two {1 + 1}, three {4 - 1}`
    const str = stringify(parse(src), {
      evaluate: (node) => evalExpression(node, {})
    })

    expect(str).toBe('One 1, two 2, three 3')
  })

  test('handles multi-line interpolation', () => {
    const src = dd`
    - foo
    - { ['bar', 'qux'].join('\\n- ') }
    `
    const str = stringify(parse(src), {
      evaluate: (node) => evalExpression(node, {})
    })

    expect(str).toBe('- foo\n- bar\n- qux')
  })
})
