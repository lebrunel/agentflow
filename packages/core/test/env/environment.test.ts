import { beforeAll, describe, expect, test } from 'bun:test'
import { Environment } from 'src/index'

describe('Environment', () => {
  let env: Environment

  describe('prompts as a plain object', () => {
    beforeAll(() => {
      env = new Environment({
        prompts: {
          'foo.mdx': 'Foo',
          './bar.mdx': 'Bar',
          'foo/bar/qux.mdx': 'Qux',
        }
      })
    })

    test('usePrompt() returns prompt for normalised path', () => {
      expect(env.usePrompt('foo.mdx')).toBe('Foo')
      expect(env.usePrompt('bar.mdx')).toBe('Bar')
      expect(env.usePrompt('foo/bar/qux.mdx')).toBe('Qux')
    })

    test('usePrompt() throws error for unknown path', () => {
      expect(() => env.usePrompt('xxx')).toThrow(/prompt not found/i)
    })
  })

  describe('prompts as a function', () => {
    beforeAll(() => {
      env = new Environment({
        prompts: () => ({
          'foo.mdx': 'Foo',
          './bar.mdx': 'Bar',
          'foo/bar/qux.mdx': 'Qux',
        })
      })
    })

    test('usePrompt() returns prompt for normalised path', () => {
      expect(env.usePrompt('foo.mdx')).toBe('Foo')
      expect(env.usePrompt('bar.mdx')).toBe('Bar')
      expect(env.usePrompt('foo/bar/qux.mdx')).toBe('Qux')
    })

    test('usePrompt() throws error for unknown path', () => {
      expect(() => env.usePrompt('xxx')).toThrow(/prompt not found/i)
    })
  })
})
