import { expect, test } from 'bun:test'
import { ZodError } from 'zod'
import { dedent as dd } from 'ts-dedent'
import { runtime } from 'test/support/runtime'

import { compileSync, ExecutionController, ExecutionCursor } from 'src/index'

// todo - organise where this test goes

test('expressions in actions are evaluated', async () => {
  const src = dd`
  Testing

  <Mock as="foo" value={['abc', 'xyz'].join(':')} />

  Huzzar: {foo}
  `
  const file = compileSync(src, { runtime })
  const workflow = file.result

  const ctrl = new ExecutionController(workflow, {}, runtime)
  await ctrl.runAll()

  expect(ctrl.getFinalOutput()).toMatch(/Testing\n\nabc:xyz/)
})

test('expressions in actions are validated at runtime', async () => {
  const src = dd`
  Testing

  <Mock as="foo" value={123} />
  `
  const file = compileSync(src, { runtime })
  const workflow = file.result

  const ctrl = new ExecutionController(workflow, {}, runtime)

  ctrl.on('action', (action) => {
    expect(() => action.output).toThrow(ZodError)
  })

  ctrl.on('error', (err) => {
    expect(err).toBeInstanceOf(ZodError)
    expect((err as ZodError).errors[0].message).toMatch(/expected string, received number/i)
  })

  await ctrl.runAll()
  expect.assertions(3)
})

test('testing loops', async () => {
  const src = dd`
  Testing

  <Mock as="foo" value="foo" />

  <Loop as="bar" until={$.self.length === 5}>
    Bar

    <Mock as="qux" value="qux" />
  </Loop>
  `
  const file = compileSync(src, { runtime })
  const workflow = file.result

  const ctrl = new ExecutionController(workflow, {}, runtime)
  await ctrl.runAll()

  expect(ctrl.state.getActionResult(ExecutionCursor.parse('/0.0.1'))?.output.value).toHaveLength(5)
  expect(ctrl.getFinalOutput()).toMatch(/(Bar\n\nqux(\n\n---\n\n)?){5}/)
})

test.skip('testing loop provide each iteration', async () => {
  const src = dd`
  ---
  data:
    choices:
      - foo
      - bar
      - qux
  ---
  Testing

  {choices}

  <Loop as="foo" until={$.index === 3} provide={{bar: choices[$.index]}}>
    Foo {$foo.index} {bar}

    <Mock as="qux" value="abc" />
  </Loop>

  Ending
  `
  const file = compileSync(src, { runtime })
  const workflow = file.result

  const ctrl = new ExecutionController(workflow, {}, runtime)
  await ctrl.runAll()

  //console.dir(ctrl.state.stateMap.values(), { depth: 4 })

  console.log(ctrl.getFinalOutput())
})

test.skip('testing magic variables in loops', async () => {
  const src = dd`
  Testing {foo}

  <Loop as="baz" until={$.self?.length === 3} provide={{ foo }}>
    | {$.index} | {$.self.length} | {$.last?.qux} | {$.self.map(f => f.qux).join(',')} | {foo} |

    <Mock as="qux" value="abc" />
  </Loop>

  {baz}

  Exiting
  `
  const file = compileSync(src, { runtime })
  const workflow = file.result

  const ctrl = new ExecutionController(workflow, { foo: { type: 'primitive', value: 'bar' } }, runtime)
  await ctrl.runAll()

  console.log(ctrl.getFinalOutput())
  //console.dir(ctrl.state.getActionResult(ExecutionCursor.parse('/0.0.0')), { depth: 4 })

  //expect(ctrl.state.getActionResult(ExecutionCursor.parse('/0.0.1'))?.output.value).toHaveLength(5)
  //expect(ctrl.getFinalOutput()).toMatch(/(Bar\n\nqux(\n\n---\n\n)?){5}/)
})

test.skip('testing loop gen', async () => {
  const { result: workflow } = compileSync(dd`
  Intro

  <Loop as="foo" until={$.index === 3}>
    <Mock as="a" value="aaa" />
    <Mock as="b" value="bbb" />
  </Loop>

  {foo}

  Exits
  `)

  const ctrl = new ExecutionController(workflow, {}, runtime)
  await ctrl.runAll()

  console.log(ctrl.getFinalOutput())
})

test.skip('testing if gen', async () => {
  const { result: workflow } = compileSync(dd`
  Intro

  <Cond as="foo" if={true}>
    <Mock as="a" value="aaa" />
    <Mock as="b" value="bbb" />
  </Cond>

  <Cond as="bar" if={false}>
    <Mock as="x" value="xxx" />
    <Mock as="y" value="yyy" />
  </Cond>

  zzz

  Foo: {foo}

  Bar: {bar}

  Exits
  `)

  const ctrl = new ExecutionController(workflow, {}, runtime)
  await ctrl.runAll()

  console.log(ctrl.getFinalOutput())
})

test.todo('parse context keys from provide', () => {
  const { result: workflow } = compileSync(dd`
  Intro

  <Mock as="a" value="aaa" />

  <Cond as="foo" if={true} provide={{ a }}>
    A {a}

    <Mock as="b" value="bbb" />
  </Cond>

  Exits
  `)
})

test.skip('xyzxyz', async () => {
  const { result: workflow } = compileSync(dd`
  Intro

  <Loop as="loop" until={$.self.length === 3}>
    A {$.index}

    <Mock as="a" value="aaa" />

    ---

    B: {a}

    <Mock as="b" value="bbb" />
  </Loop>

  {loop}

  <Mock as="c" value="ccc" />

  Exits
  `)

  const ctrl = new ExecutionController(workflow, {}, runtime)
  await ctrl.runAll()
  console.log(ctrl.getFinalOutput())
})
