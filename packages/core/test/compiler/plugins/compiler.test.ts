import { describe, expect, test } from 'bun:test'
import { runtime } from 'test/support/runtime'
import { unified } from 'unified'
import { toString } from 'mdast-util-to-string'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { VFile } from 'vfile'
import { dedent as dd } from 'ts-dedent'

import { workflowVisitor, workflowStructure, workflowCompiler } from 'src/compiler/plugins/index'
import type { CompileOptions } from 'src/index'

function compile(src: string | VFile, opts: CompileOptions = {}) {
  const proc = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMdx)
    .use(workflowVisitor, opts)
    .use(workflowStructure, opts)
    .use(workflowCompiler, opts)

  return proc.processSync(src)
}

describe('workflowCompiler()', () => {
  const src = dd`
  ---
  foo: bar
  input:
    name:
      type: text
  ---

  # Title

  Intro paragraph

  ---

  Para

  <Mock as="a" value="aaa" />

  ---

  <Loop as="l" until={$index === 3}>

    Para

    <Mock as="b" value="bbb" />

    ---

    <Cond as="i" if={b === "bbb"}>
      <Mock as="c" value="ccc" />
    </Cond>
  </Loop>

  Final para
  `
  const { result: workflow } = compile(src, { runtime })

  test('.meta parsed from frontmatter', () => {
    expect(workflow.meta.foo).toBe('bar')
    expect(workflow.meta.input).toEqual({ name: { type: 'text' }})
  })

  test('.descriptionNodes from introductory text', () => {
    expect(workflow.descriptionNodes.length).toBe(2)
    expect(toString(workflow.descriptionNodes[0])).toBe('Title')
    expect(toString(workflow.descriptionNodes[1])).toBe('Intro paragraph')
  })

  test('.phases structure', () => {
    expect(workflow.phases.length).toBe(2)
    expect(workflow.phases[0].actions.length).toBe(1)
    expect(workflow.phases[0].contextKeys).toEqual(new Set(['name', 'a']))
    expect(workflow.phases[0].trailingNodes.length).toBe(0)
    expect(workflow.phases[1].actions.length).toBe(1)
    expect(workflow.phases[1].contextKeys).toEqual(new Set(['name', 'a', 'l']))
    expect(workflow.phases[1].trailingNodes.length).toBe(1)
  })

  test('.phases.actions structure', () => {
    const action = workflow.phases[0].actions[0]
    expect(action.name).toBe('mock')
    expect(action.contextKey).toBe('a')
    expect(action.contentNodes.length).toBe(1)
    expect(action.props).toEqual({ as: 'a', value: 'aaa' })
  })

  test('.phases.actions with sub phases', () => {
    const action = workflow.phases[1].actions[0]
    expect(action.name).toBe('loop')
    expect(action.phases.length).toBe(2)
    expect(action.phases[1].actions[0].name).toBe('cond')
    expect(action.phases[1].actions[0].phases[0].actions[0].name).toBe('mock')
    expect(action.phases[1].actions[0].phases[0].actions[0].contextKey).toBe('c')
  })
})

describe('workflowCompiler() .title', () => {
  test('gets title from metadata', () => {
    const { result: workflow } = compile(dd`
    ---
    title: Foo
    ---

    Bar
    `, { runtime })

    expect(workflow.title).toBe('Foo')
  })

  test('gets title workflow intro', () => {
    const { result: workflow } = compile(dd`
    # Foo

    Bar

    ---

    <Mock as="a" value="aaa" />
    `, { runtime })

    expect(workflow.title).toBe('Foo')
  })

  test('gets title workflow first phase', () => {
    const { result: workflow } = compile(dd`
    # Foo

    Bar

    <Mock as="a" value="aaa" />
    `, { runtime })

    expect(workflow.title).toBe('Foo')
  })

  test('gets title from filepath', () => {
    const { result: workflow } = compile(new VFile({
      path: '/path/to/example.md',
      value: 'Paragraph',
    }))

    expect(workflow.title).toBe('example.md')
  })

  test('fallback to default title', () => {
    const { result: workflow } = compile(dd`
    Bar

    <Mock as="a" value="aaa" />
    `, { runtime })

    expect(workflow.title).toBe('Untitled')
  })
})

describe('workflowCompiler() validations', () => {
  test('actions cannot create context duplicating with input', () => {
    const src = dd`
    ---
    input:
      foo:
        type: text
    ---

    Paragraph

    <GenText as="foo" model="openai:gpt-4o" />
    `
    expect(() => compile(src, { runtime })).toThrow(/duplicate context/i)
  })

  test('actions cannot create context duplicate with previous actions', () => {
    const src = dd`
    Paragraph

    <GenText as="foo" model="openai:gpt-4o" />

    ---

    Paragraph

    <GenText as="foo" model="openai:gpt-4o" />
    `
    expect(() => compile(src, { runtime })).toThrow(/duplicate context/i)
  })

  test('expressions can reference context that exists', () => {
    const src = dd`
    ---
    input:
      name:
        type: text
    ---

    Paragraph

    <GenText as="description" model="openai:gpt-4o" />

    ---

    Paragraph {name}

    Paragraph {description}
    `
    expect(() => compile(src, { runtime })).not.toThrow()
  })

  test('expressions cannot reference context that is undefined', () => {
    const src = dd`
    ---
    input:
      name:
        type: text
    ---

    Paragraph {name}

    Paragraph {description}

    <GenText as="description" model="openai:gpt-4o" />
    `
    expect(() => compile(src, { runtime })).toThrow(/unknown context/i)
  })

  test('child scope can access provided context from parent scope', () => {
    const src = dd`
    ---
    input:
      languages:
        type: array
    ---

    <GenText as="poem" model="openai:gpt-4o" />

    <Loop
      as="translations"
      until={$index === languages.length}
      provide={{ poem, languages }}>

      Translate to {languages[$index]}:

      {poem}

      <GenText as="translation" model="openai:gpt-4o" />
    </Loop>
    `
    expect(() => compile(src, { runtime })).not.toThrow()
  })

  test('child scope cannot access context not provided from parent scope', () => {
    const src = dd`
    ---
    input:
      languages:
        type: array
    ---

    <GenText as="poem" model="openai:gpt-4o" />

    <Loop
      as="translations"
      until={$index === languages.length}
      provide={{ languages }}>

      Translate to {languages[$index]}:

      {poem}

      <GenText as="translation" model="openai:gpt-4o" />
    </Loop>
    `
    expect(() => compile(src, { runtime })).toThrow(/unknown context/i)
  })

  test('nested scope can access context provided from parent scope', () => {
    const src = dd`
    ---
    input:
      languages:
        type: array
      styles:
        type: array
    ---

    <GenText as="poem" model="openai:gpt-4o" />

    <Loop
      as="translations"
      until={$index === languages.length}
      provide={{ poem, languages, styles, $parentIndex: $index }}>

      <Loop
        as="styledTranslations"
        until={$index === styles.length}
        provide={{ poem, language: languages[$parentIndex], styles }}>

        Translate to {language} in {styles[$index]} style:

        {poem}

        <GenText as="translation" model="openai:gpt-4o" />
      </Loop>
    </Loop>
    `
    expect(() => compile(src, { runtime })).not.toThrow()
  })

  test('nested scope cannot access context not provided from parent scope', () => {
    const src = dd`
    ---
    input:
      languages:
        type: array
      styles:
        type: array
    ---

    <GenText as="poem" model="openai:gpt-4o" />

    <Loop
      as="translations"
      until={$index === languages.length}
      provide={{ languages, styles, $parentIndex: $index }}>

      <Loop
        as="styledTranslations"
        until={$index === styles.length}
        provide={{ language: languages[$parentIndex], styles }}>

        Translate to {language} in {styles[$index]} style:

        {poem}

        <GenText as="translation" model="openai:gpt-4o" />
      </Loop>
    </Loop>
    `
    expect(() => compile(src, { runtime })).toThrow(/unknown context/i)
  })
})
