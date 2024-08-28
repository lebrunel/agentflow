import { beforeEach, describe, expect, test } from 'bun:test'
import { ZodError } from 'zod'
import { default as dd } from 'ts-dedent'
import { runtime } from 'test/support/runtime'
import { compileSync, executeWorkflow, ExecutionController, ExecutionStatus } from '~/index'

// todo - organise where this test goes



test('expressions in actions are evaluated', async (done) => {
  const src = dd`
  Testing

  <Mock name="foo" type="text" value={['abc', 'xyz'].join(':')} />

  Huzzar: {foo}
  `
  const file = compileSync(src, { runtime })
  const workflow = file.result

  const ctrl = executeWorkflow(workflow, {}, runtime)

  ctrl.on('complete', output => {
    expect(output).toMatch(/Testing\n\nabc:xyz/)
    done()
  })

  ctrl.on('error', err => {
    console.error('ERROR:', err)
    done()
  })
})

test('expressions in actions are validated at runtime', async (done) => {
  const src = dd`
  Testing

  <Mock name="foo" type="text" value={123} />
  `
  const file = compileSync(src, { runtime })
  const workflow = file.result

  const ctrl = executeWorkflow(workflow, {}, runtime)

  ctrl.on('error', (err) => {
    expect(err).toBeInstanceOf(ZodError)
    expect((err as ZodError).errors[0].message).toMatch(/expected string, received number/i)
    done()
  })
})
