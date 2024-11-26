import { describe, expect, test } from 'bun:test'
import { dedent as dd } from 'ts-dedent'
import { env } from 'test/support/env'

import { compileSync, ExecutionController } from 'src/index'
import type { Workflow } from 'src/index'

describe('<Loop />', () => {
  function compile(src: string): Workflow {
    const file = compileSync(src, { env })
    return file.result
  }

  test('children are evaluated until condition is met', async () => {
    const src = dd`
    Test

    <Loop as="test" until={$.index === 3}>
      Loop {$.index}
    </Loop>
    `
    const workflow = compile(src)

    const ctrl = new ExecutionController(workflow, {}, env)
    await ctrl.runAll()

    expect(ctrl.getFinalOutput()).toMatch(/^Test(\n\n---\n\nLoop \d){3}$/)
  })

  test('handles nested phases and actions in children', async () => {
    const src = dd`
    Test

    <Loop as="test" until={$.index === 3}>
      A

      <Mock as="a" value="aaa" />

      B

      <Mock as="b" value="bbb" />

      ---

      C

      <Mock as="c" value="ccc" />
    </Loop>
    `
    const workflow = compile(src)

    const ctrl = new ExecutionController(workflow, {}, env)
    await ctrl.runAll()

    expect(ctrl.getFinalOutput()).toMatch(/^Test(\n\n---\n\nA\n\naaa\n\nB\n\nbbb\n\n---\n\nC\n\nccc){3}$/)
  })

  test('provide creates scope for each iteration', async () => {
    const src = dd`
    ---
    data:
      all: ['a', 'b', 'c']
    ---

    Test

    <Loop as="test" until={$.index === 3} provide={{ a: all[$.index] }}>
      T {$.index} {a}

      <Mock as="b" value={a} />
    </Loop>
    `
    const workflow = compile(src)

    const ctrl = new ExecutionController(workflow, {
      all: { type: 'json', value: ['a', 'b', 'c'] }
    }, env)
    await ctrl.runAll()

    expect(ctrl.getFinalOutput()).toMatch(/^Test(\n\n---\n\nT \d [abc]\n\n[abc]){3}$/)
  })

  test('the last helper returns the last iteration or undefined', async () => {
    const src = dd`
    ---
    data:
      all: ['a', 'b', 'c']
    ---

    Test

    <Loop as="test" until={$.index === 3} provide={{ a: all[$.index] }}>
      L {$.last?.b}

      <Mock as="b" value={a} />
    </Loop>
    `
    const workflow = compile(src)

    const ctrl = new ExecutionController(workflow, {
      all: { type: 'json', value: ['a', 'b', 'c'] }
    }, env)
    await ctrl.runAll()

    expect(ctrl.getFinalOutput()).toMatch(/^Test\n\n---\n\nL undefined\n\n[abc](\n\n---\n\nL [ab]\n\n[abc]){2}$/)
  })

  test('can access outer and inner helpers in nested loops ', async () => {
    const src = dd`
    Test

    <Loop as="outer" until={$.index === 2}>
      <Loop as="inner" until={$.index === 2} provide={{ o: $outer.index, i: $.index }}>
        {o} {i}
      </Loop>
    </Loop>
    `
    const workflow = compile(src)

    const ctrl = new ExecutionController(workflow, {
      all: { type: 'json', value: ['a', 'b', 'c'] }
    }, env)

    await ctrl.runAll()

    expect(ctrl.getFinalOutput()).toMatch(new RegExp([
      '^Test',
      '\n\n---\n\n0 0',
      '\n\n---\n\n0 1',
      '\n\n---\n\n1 0',
      '\n\n---\n\n1 1',
      '$'
      ].join('')))
  })
})
