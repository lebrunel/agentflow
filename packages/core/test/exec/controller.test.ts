import { beforeEach, describe, expect, test } from 'bun:test'
import dd from 'ts-dedent'
import { env } from 'test/support/env'

import { compileSync, ExecutionController, ExecutionStatus } from 'src/index'
import { ExecutionCursor, type ContextValueMap } from 'src/index'

const src = dd`
---
input:
  name:
    type: text
---

Do a thing

<Mock as="a1" value="Result of A1" />

Do another thing

<Mock as="a2" value="Result of A2" />

---

This is another phase

<Mock as="b1" value="Result of B1" />

A final thing

<Mock as="b2" value="Result of B2" />

Testing the suffix: {a1}
`
const file = compileSync(src, env)
const workflow = file.result

describe('ExecutionController', () => {
  let ctrl: ExecutionController

  beforeEach(() => {
    const context: ContextValueMap = { foo: { type: 'primitive', value: 'bar' } }
    ctrl = new ExecutionController(workflow, context)
  })

  test('initializes with correct initial state', () => {
    expect(ctrl.cursor.toString()).toBe('/0.0.0')
    expect(ctrl.status).toBe(ExecutionStatus.Ready)
    expect(ctrl.currentScope).toEqual(workflow.view)
    expect(ctrl.currentPhase).toEqual(workflow.view.phases[0])
    expect(ctrl.currentStep).toEqual(workflow.view.phases[0].steps[0])
  })

  test('runNext() advances cursor and updates state correctly', async () => {
    await ctrl.runNext()
    expect(ctrl.cursor.toString()).toBe('/0.0.1')
    expect(ctrl.status).toBe(ExecutionStatus.Paused)
  })

  test('runAll() executes all actions and completes', async () => {
    await ctrl.runAll()
    expect(ctrl.cursor.toString()).toBe('/0.1.2')
    expect(ctrl.status).toBe(ExecutionStatus.Completed)
  })

  test('pause() stops execution during runAll()', async () => {
    await ctrl.runAll((_result, cursor) => {
      if (cursor.phaseIndex === 0 && cursor.stepIndex === 1) {
        ctrl.pause()
      }
    })

    expect(ctrl.cursor.toString()).toBe('/0.1.0')
    expect(ctrl.status).toEqual(ExecutionStatus.Paused)
  })

  test('rewindTo() moves cursor correctly and clears results', async () => {
    await ctrl.runAll()
    ctrl.rewindTo('/0.0.1')

    expect(ctrl.cursor.toString()).toBe('/0.0.1')
    expect(ctrl.status).toEqual(ExecutionStatus.Paused)
  })

  test('reset() returns to initial state', async () => {
    await ctrl.runAll()
    ctrl.reset()

    expect(ctrl.cursor.toString()).toBe('/0.0.0')
    expect(ctrl.status).toEqual(ExecutionStatus.Ready)
  })

  test('events are emitted correctly', async () => {
    let statusEvents = 0
    let phaseEvents = 0
    let stepEvents = 0
    let completeEvents = 0
    let errorEvents = 0
    let rewindEvents = 0

    ctrl.on('status', () => statusEvents++)
    ctrl.on('phase', () => phaseEvents++)
    ctrl.on('step', () => stepEvents++)
    ctrl.on('complete', () => completeEvents++)
    ctrl.on('error', () => errorEvents++)
    ctrl.on('error', console.error)
    ctrl.on('rewind', () => rewindEvents++)

    await ctrl.runAll()
    ctrl.reset()

    expect(statusEvents).toBe(3)
    expect(phaseEvents).toBe(2)
    expect(stepEvents).toBe(5)
    expect(completeEvents).toBe(1)
    expect(errorEvents).toBe(0)
    expect(rewindEvents).toBe(1)
  })

  test.todo('error handling in runAll()', async () => {
    // Simulate an action that throws an error
    // Assert that the status changes to Error
    // Assert that execution stops and the error event is emitted
  })

  test('getCompleteOutput() generates correct output for entire workflow', async () => {
    await ctrl.runAll()
    const output = ctrl.getFinalOutput()

    expect(output).toBe(dd`
    Do a thing

    Result of A1

    Do another thing

    Result of A2

    ---

    This is another phase

    Result of B1

    A final thing

    Result of B2

    Testing the suffix: Result of A1
    `)
  })

  test('getFinalResults() returns an iterable', async () => {
    await ctrl.runAll()
    const results = ctrl.getFinalResults()

    expect(results[Symbol.iterator]).toBeDefined()

    let count = 0
    let prevCursor: ExecutionCursor | undefined

    for (const [cursor, result] of results) {
      expect(cursor).toBeInstanceOf(ExecutionCursor)
      expect(result.content).toBeArray()

      if (prevCursor) {
        expect(cursor.gt(prevCursor)).toBeTrue()
      }

      if (result.action) {
        expect(result.action).toHaveProperty('cursor')
        expect(result.action).toHaveProperty('name')
        expect(result.action).toHaveProperty('contextKey')
        expect(result.action).toHaveProperty('result')
      }

      count++
      prevCursor = cursor

    }

    expect(count).toBe(5)
  })
})
