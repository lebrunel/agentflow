import { describe, expect, test } from 'bun:test'
import { VFile } from 'vfile'
import dd from 'ts-dedent'
import { env } from 'test/support/env'
import { Workflow } from 'src/workflow'

describe('Workflow', () => {
  test('meta derived from frontmatter', () => {
    const workflow = Workflow.compileSync(dd`
    ---
    title: Foo bar
    data:
      foo: bar
    ---

    Hello world
    `, { env })
    expect(workflow.meta).toEqual({ title: 'Foo bar', data: { foo: 'bar' }})
  })

  test('title derived from metadata', () => {
    const workflow = Workflow.compileSync(dd`
    ---
    title: Foo
    ---

    # Bar
    `, { env })
    expect(workflow.title).toBe('Foo')
  })

  test('title derived from first title', () => {
    const workflow = Workflow.compileSync('# Bar', { env })
    expect(workflow.title).toBe('Bar')
  })

  test('title derived from filename', () => {
    const workflow = Workflow.compileSync(new VFile({
      path: '/path/to/example.md',
      value: 'Foo bar',
    }), { env })
    expect(workflow.title).toBe('example.md')
  })

  test('title default', () => {
    const workflow = Workflow.compileSync('Foo bar', { env })
    expect(workflow.title).toBe('Untitled')
  })
})

test('Workflow.compile() asyncronously compiles to a workflow', () => {
  expect(Workflow.compile('Test', { env })).resolves.toBeInstanceOf(Workflow)
})

test('Workflow.compileSync() compiles to a workflow', () => {
  expect(Workflow.compileSync('Test', { env })).toBeInstanceOf(Workflow)
})
