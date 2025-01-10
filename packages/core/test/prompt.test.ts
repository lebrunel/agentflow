import { describe, expect, test } from 'bun:test'
import dd from 'ts-dedent'
import { createEnv } from 'test/support/env'
import { Prompt } from 'src'
import { createPromptProcessor } from 'src/ast'
import type { Processor } from 'unified'

let proc: Processor

describe('Prompt', () => {
  test('stringifies simple values onto single line', () => {
    const proc = createPromptProcessor(createEnv({
      prompts: {
        'bar.mdx': 'Bar',
        'baz.mdx': 'Baz',
      }
    }))

    const src = dd`
    Foo {include('bar.mdx')} {include('baz.mdx')}
    `

    const prompt = new Prompt('start', src, proc)
    prompt.process()

    expect(prompt.toString()).toBe('Foo Bar Baz')
  })

  test('stringifies chained includes', () => {
    const proc = createPromptProcessor(createEnv({
      prompts: {
        'bar.mdx': `Bar {include('baz.mdx')}`,
        'baz.mdx': 'Baz',
      }
    }))

    const src = dd`
    Foo {include('bar.mdx')}
    `

    const prompt = new Prompt('start', src, proc)
    prompt.process()

    expect(prompt.toString()).toBe('Foo Bar Baz')
  })

  test('stringifies multi-line values correctly', () => {
    const proc = createPromptProcessor(createEnv({
      prompts: {
        'bar.mdx': dd`
        # Bar

        bar
        `,
        'baz.mdx': dd`
        # Baz

        baz
        `,
      }
    }))

    const src = dd`
    Foo {include('bar.mdx')} {include('baz.mdx')}
    `

    const prompt = new Prompt('start', src, proc)
    prompt.process()

    expect(prompt.toString()).toBe('Foo # Bar\n\nbar # Baz\n\nbaz')
  })

  test('ignores markdown comments in prompts', () => {
    const proc = createPromptProcessor(createEnv({
      prompts: {
        'bar.mdx': dd`
        > Comment

        bar
        `,
      }
    }))

    const src = dd`
    Foo

    {include('bar.mdx')}
    `

    const prompt = new Prompt('start', src, proc)
    prompt.process()

    expect(prompt.toString()).toBe('Foo\n\nbar')
  })

  test('stringifies xml-like elemnts in prompts', () => {
    const proc = createPromptProcessor(createEnv({
      prompts: {
        'bar.mdx': dd`
        <example>Quote</example>

        bar
        `,
      }
    }))

    const src = dd`
    Foo

    {include('bar.mdx')}
    `

    const prompt = new Prompt('start', src, proc)
    prompt.process()

    expect(prompt.toString()).toBe('Foo\n\n<example>Quote</example>\n\nbar')
  })

  test('actions in prompts are re-stringified', () => {
    const proc = createPromptProcessor(createEnv({
      prompts: {
        'bar.mdx': dd`
        <GenText as="bar" model={dynamic} />

        Baz
        `,
      }
    }))

    const src = dd`
    Foo

    {include('bar.mdx')}
    `

    const prompt = new Prompt('start', src, proc)
    prompt.process()

    expect(prompt.toString()).toBe('Foo\n\n<GenText as="bar" model={dynamic} />\n\nBaz')
  })
})
