import { beforeAll, describe, expect, test } from 'bun:test'
import { VFile } from 'vfile'
import dd from 'ts-dedent'
import { env, createEnv } from 'test/support/env'
import { createCompiler, compile, stringify } from 'src/ast'
import { createSealedEvaluator } from 'src/exec'
import { Workflow } from 'src/workflow'
import type { Processor } from 'unified'
import type { Paragraph, Root, Yaml } from 'mdast'
import type { ActionNode, ExpressionNode } from 'src'
import { selectAll } from 'unist-util-select'


function isWorkflowVFile(val: any): val is VFile {
  return val
    && typeof val === 'object'
    && ['basename', 'dirname', 'extname', 'path'].every(key => key in val)
    && val.result instanceof Workflow
}


describe('createCompiler()', () => {
  let proc: Processor<Root, Root, Root, Root, Workflow>

  beforeAll(() => {
    proc = createCompiler(env)
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
    expect(file).toSatisfy(isWorkflowVFile)
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
  test('returns a VFile', () => {
    expect(compile('Test', env)).toSatisfy(isWorkflowVFile)
  })
})

describe('compiling with Prompts', () => {
  test('compiles with simple valid includes', () => {
    const env = createEnv({
      prompts: {
        'foo.mdx': 'Foo',
        'bar.mdx': 'Bar',
      }
    })

    const src = dd`
    Hello:

    {include('foo.mdx')} {include('bar.mdx')}
    `

    const file = compile(src, env)
    const workflow = file.result
    expect(workflow.ast.children).toHaveLength(2)
    expect(selectAll('expression', workflow.ast.children[1])).toHaveLength(2)
  })

  test('compiles with or without include extension', () => {
    const env = createEnv({
      prompts: {
        'foo.mdx': 'Foo',
        'bar.mdx': 'Bar',
      }
    })

    const src = dd`
    Hello:

    {include('foo')} {include('bar')}
    `

    const file = compile(src, env)
    const workflow = file.result
    expect(workflow.ast.children).toHaveLength(2)
    expect(selectAll('expression', workflow.ast.children[1])).toHaveLength(2)
  })

  test('compiles with multiple of same includes', () => {
    const env = createEnv({
      prompts: {
        'foo.mdx': 'Foo',
      }
    })

    const src = dd`
    Hello:

    {include('foo.mdx')} {include('foo.mdx')}
    `

    const file = compile(src, env)
    const workflow = file.result
    expect(workflow.ast.children).toHaveLength(2)
    expect(selectAll('expression', workflow.ast.children[1])).toHaveLength(2)
  })

  test('compiles with chain of valid includes', () => {
    const env = createEnv({
      prompts: {
        'foo.mdx': `{include('bar.mdx')}`,
        'bar.mdx': 'Bar',
      }
    })

    const src = dd`
    Hello:

    {include('foo.mdx')}
    `

    const file = compile(src, env)
    const workflow = file.result
    expect(workflow.ast.children).toHaveLength(2)
    expect(selectAll('expression', workflow.ast.children[1])).toHaveLength(1)
  })

  test('throws error if include not found', () => {
    const src = dd`
    Hello:

    {include('foo.mdx')}
    `
    expect(() => compile(src, env)).toThrow(/prompt not found/i)
  })

  test('throws error if circular import', () => {
    const env = createEnv({
      prompts: {
        'foo.mdx': `{include('bar.mdx')}\n`,
        'bar.mdx': `{include('foo.mdx')}\n`,
      }
    })

    const src = dd`
    Hello:

    {include('foo.mdx')}
    `
    expect(() => compile(src, env)).toThrow(/circular dependency/i)
  })

})


describe('Fragments', () => {
  const env = createEnv({
    prompts: { 'bar.mdx': 'Bar' }
  })

  const proc = createCompiler(env)
  const evaluate = createSealedEvaluator(env)

  function compile(src: string): Root {
    const ast = proc.parse(src)
    return proc.runSync(ast)
  }

  // Test cases
  const tests = {
    simple: dd`
    Test

    {<>Foo</>}
    `,

    simpleArray: dd`
    Test

    {[1,2].map(n => (
      <>
        Foo {n}
      </>
    ))}
    `,

    deepArray: dd`
    Test

    {[1,2].map(a => (
      <>
        {[1,2].map(b => (
          <>
            {[1,2].map(c => (
              <>
                Foo {a} {b} {c}
                Bar {a * b * c}
              </>
            ))}
          </>
        ))}
      </>
    ))}
    `,

    inline: `Test {<>Foo</>}`,

    inlineArray: `Test {[1,2].map(n => (<>Foo {n}</>))}`,

    mixed: dd`
    Test

    {
      <>
        Foo {include('bar.mdx')}
      </>
    }
    `
  }

  test('compile into _fragment() function calls', () => {
    const ast = compile(tests.simple)
    expect(ast.children).toHaveLength(2)
    expect(ast.children[1].type).toBe('expression')
    expect(stringify(ast)).toMatch(`_fragment('Foo',{})`)
  })

  test('compile into _fragment() function calls with dependent args', () => {
    const ast = compile(tests.simpleArray)
    expect(ast.children).toHaveLength(2)
    expect(ast.children[1].type).toBe('expression')
    expect(stringify(ast)).toMatch(`_fragment('Foo {n}',{n})`)
  })

  test('compile deep fragments into nested function calls', () => {
    const ast = compile(tests.deepArray)
    expect(ast.children).toHaveLength(2)
    expect(ast.children[1].type).toBe('expression')
    expect(stringify(ast)).toMatch(/(?:.*?_fragment\(){3}.*/)
  })

  test('evaluate inline fragments into a string', () => {
    const ast = compile(tests.inline)
    expect(stringify(ast, { evaluate })).toBe('Test Foo')
  })

  test('evaluate inline fragment arrays into a string', () => {
    const ast = compile(tests.inlineArray)
    expect(stringify(ast, { evaluate })).toBe('Test Foo 1\nFoo 2')
  })

  test('evaluate fragment arrays into a string', () => {
    const ast = compile(tests.simpleArray)
    expect(stringify(ast, { evaluate })).toMatch(/(\nFoo \d){2}/m)
  })

  test('evaluates deep fragment arrays into string', () => {
    const ast = compile(tests.deepArray)
    expect(stringify(ast, { evaluate })).toMatch(/(\nFoo \d \d \d\nBar \d){8}/m)
  })

  test('compiles and evaluates fragments with nested include statements', () => {
    const ast = compile(tests.mixed)
    expect(ast.children).toHaveLength(2)
    expect(ast.children[1].type).toBe('expression')
    expect(stringify(ast)).toMatch(`Foo {_fragment('Bar')}`)
    expect(stringify(ast, { evaluate })).toMatch('Test\n\nFoo Bar')
  })
})

describe('Prompt', () => {
  const env = createEnv({
    prompts: {
      'bar.mdx': 'Bar',
      'baz.mdx': 'Baz',
      'barbaz.mdx': `Bar {include('baz.mdx')}`,

      'barmulti.mdx': dd`
      # Bar

      Bar
      `,

      'bazmulti.mdx': dd`
      # Baz

      Baz
      `,

      'barcomment.mdx': dd`
      > Comment

      Bar
      `,

      'barxml.mdx': dd`
      <example>Quote</example>

      Bar
      `,

      'baraction.mdx': dd`
      <GenText as="bar" model="gpt-4o" />

      Bar
      `,
    }
  })

  const proc = createCompiler(env)
  const evaluate = createSealedEvaluator(env)

  function compile(src: string): Root {
    const ast = proc.parse(src)
    return proc.runSync(ast)
  }

  test('stringifies simple values onto single line', () => {
    const src = dd`
    Foo {include('bar.mdx')} {include('baz.mdx')}
    `

    const ast = compile(src)
    expect(stringify(ast)).toMatch(`Foo {_fragment('Bar')} {_fragment('Baz')}`)
    expect(stringify(ast, { evaluate })).toMatch('Foo Bar Baz')
  })

  test('stringifies chained includes', () => {
    const src = dd`
    Foo {include('barbaz.mdx')}
    `

    const ast = compile(src)
    expect(stringify(ast)).toMatch(/(?:.*?_fragment\(){2}.*/)
    expect(stringify(ast, { evaluate })).toMatch('Foo Bar Baz')
  })

  test('stringifies multi-line values correctly', () => {
    const src = dd`
    Foo {include('barmulti.mdx')} {include('bazmulti.mdx')}
    `

    const ast = compile(src)
    expect(stringify(ast)).toMatch(/(?:.*?_fragment\(){2}.*/)
    expect(stringify(ast, { evaluate })).toMatch('Foo # Bar\n\nBar # Baz\n\nBaz')
  })

  test('ignores markdown comments in prompts', () => {
    const src = dd`
    Foo

    {include('barcomment.mdx')}
    `

    const ast = compile(src)
    expect(stringify(ast)).toMatch(`Foo\n\n{_fragment('Bar')`)
    expect(stringify(ast, { evaluate })).toMatch('Foo\n\nBar')
  })

  test('stringifies xml-like elemnts in prompts', () => {
    const src = dd`
    Foo

    {include('barxml.mdx')}
    `

    const ast = compile(src)
    expect(stringify(ast)).toMatch(/Foo\n\n{_fragment\('.*'\)/)
    expect(stringify(ast, { evaluate })).toMatch('Foo\n\n<example>Quote</example>\n\nBar')
  })

  test('actions in prompts are re-stringified', () => {
    const src = dd`
    Foo

    {include('baraction.mdx')}
    `

    const ast = compile(src)
    expect(stringify(ast)).toMatch(/Foo\n\n{_fragment\('.*'\)/)
    expect(stringify(ast, { evaluate })).toMatch('Foo\n\n<GenText as="bar" model="gpt-4o" />\n\nBar')
  })
})
