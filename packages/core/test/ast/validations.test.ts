import { describe, expect, test } from 'bun:test'
import { u } from 'unist-builder'
import { VFile } from 'vfile'
import { env, createEnv } from 'test/support/env'
import { compile, validateDependency, validateUniqueness } from 'src/ast'
import dd from 'ts-dedent'
import type { Environment } from 'src'

describe('validateWorkflow()', () => {
  function validate(src: string, e: Environment = env): VFile {
    return compile(src, e) // calls validateWorkflow internally
  }

  test('accepts workflow with known actions', () => {
    const src = dd`
    Hello

    <Mock as="foo" value="test" />

    <Cond as="t1" if={true}>
      Test 1

      <GenText as="bar" model="gpt-4o" />
    </Cond>

    <Loop as="t2" until={$.index === 2}>
      Test 2

      <GenObject as="qux" model="gpt-4o" schema={$.z} />
    </Loop>
    `

    expect(() => validate(src)).not.toThrow()
  })

  test('unknown actions accepted but cause warning', () => {
    const src = dd`
    Hello

    <Mock as="foo" value="test" />

    <Break as="test" />
    `

    expect(() => {
      const file = validate(src)
      expect(file.messages).toHaveLength(1)
      expect(file.messages[0].message).toMatch(/not recognized as a registered action/i)
    }).not.toThrow()
  })

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

  describe('within Fragments', () => {
    test('unknown actions are valid and accepted as raw html', () => {
      const src = dd`
      {
        <>
          <think foo="bar" qux={123}>Baz</think>
        </>
      }
      `

      expect(() => validate(src)).not.toThrow()
    })

    test('recognised actions are treated as raw html with a warning', () => {
      const src = dd`
      {
        <>
          <GenText as="foo" model="gpt-4o" />
        </>
      }
      `

      expect(() => {
        const file = validate(src)
        expect(file.messages).toHaveLength(1)
        expect(file.messages[0].message).toMatch(/actions in fragments/i)
      }).not.toThrow()
    })
  })

  describe('within Prompts', () => {
    const env = createEnv({
      prompts: {
        'a.mdx': `<think foo="bar" qux={123}>Baz</think>`,
        'b.mdx': `<GenText as="foo" model="gpt-4o" />`
      }
    })

    test('unknown actions are valid and accepted as raw html', () => {
      const src = `{include('a')}`
      expect(() => validate(src, env)).not.toThrow()
    })

    test('recognised actions are treated as raw html with a warning', () => {
      const src = `{include('b')}`

      expect(() => {
        const file = validate(src, env)
        expect(file.messages).toHaveLength(1)
        expect(file.messages[0].message).toMatch(/actions in fragments/i)
      }).not.toThrow()
    })
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
