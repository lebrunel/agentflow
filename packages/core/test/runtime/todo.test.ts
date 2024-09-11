import { expect, test } from 'bun:test'
import { ZodError } from 'zod'
import { default as dd } from 'ts-dedent'
import { runtime } from 'test/support/runtime'
import { compileSync, executeWorkflow, ExecutionController, ExecutionCursor, ExecutionStatus } from '~/index'
import type { JsonContextValue } from '~/context'

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
  // This will prevent the process from crashing
});

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

  <Loop as="bar" until={$self.length === 5}>
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

test.skip('testing magic variables in loops', async () => {
  const src = dd`
  Testing {foo}

  <Loop as="foo" until={$self?.length === 3} inject={({ foo })}>
    | {$index} | {$self.length} | {$last.bar} | {foo}
    <Mock as="bar" value="x" />
  </Loop>

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
