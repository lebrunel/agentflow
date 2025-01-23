import { describe, expect, test } from 'bun:test'
import { dedent as dd } from 'ts-dedent'
import { env } from 'test/support/env'

import { ExecutionController } from 'src/index'
import { Workflow } from 'src/index'

describe('<Cond />', () => {
  function compile(src: string): Workflow {
    return Workflow.compile(src, env)
  }

  test('children are evaluated when if is true', async () => {
    const src = dd`
    Test

    <Cond as="a" if={true}>
      True
    </Cond>
    <Cond as="b" if={false}>
      False
    </Cond>
    `
    const workflow = compile(src)
    const ctrl = workflow.createExecution()
    await ctrl.runAll()

    expect(ctrl.getFinalOutput()).toMatch(/^Test\n\n---\n\nTrue$/)
  })

  test('handles nested phases and actions in children', async () => {
    const src = dd`
    Test

    <Cond as="test" if={true}>
      A

      <Mock as="a" value="aaa" />

      B

      <Mock as="b" value="bbb" />

      ---

      C

      <Mock as="c" value="ccc" />
    </Cond>
    `
    const workflow = compile(src)
    const ctrl = workflow.createExecution()
    await ctrl.runAll()

    expect(ctrl.getFinalOutput()).toMatch(/^Test\n\n---\n\nA\n\naaa\n\nB\n\nbbb\n\n---\n\nC\n\nccc$/)
  })

  test('children recieve context from provide', async () => {
    const src = dd`
    ---
    data:
      c: ccc
    ---

    Test

    <Cond as="test" if={true} provide={{ a: 'aaa', b: 'bbb', c }}>
      {a}:{b}:{c}
    </Cond>
    `
    const workflow = compile(src)
    const ctrl = workflow.createExecution()
    await ctrl.runAll()

    expect(ctrl.getFinalOutput()).toMatch(/^Test\n\n---\n\naaa:bbb:ccc$/)
  })
})
