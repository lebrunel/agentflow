import { beforeEach, describe, expect, test } from 'bun:test'
import { runtime } from 'test/support/runtime'

import { compileWorkflow, executeWorkflow, ExecutionController, ExecutionStatus } from '~/index'
import { dd } from '~/util'
import type { ContextValueMap } from '~/runtime/context'

const src = dd`
---
inputs:
  - name: foo
    type: text
---
# Hello

This is an introduction

---

Do a thing

\`\`\`mock@a1
type: text
text: Result of A1
\`\`\`

Do another thing

\`\`\`mock@a2
type: text
text: Result of A2
\`\`\`

---

This is another phase

\`\`\`mock@b1
type: text
text: Result of B1
\`\`\`

A final thing

\`\`\`mock@b2
type: text
text: Result of B2
\`\`\`

Testing the suffix: \`@a1\`
`
const workflow = compileWorkflow(src, runtime)

describe('ExecutionController', () => {
  let controller: ExecutionController

  beforeEach(() => {
    const context: ContextValueMap = { foo: { type: 'text', text: 'bar' } }
    controller = executeWorkflow(workflow, context, runtime, { start: false })
  })

  test('Initializes with correct initial state', () => {
    expect(controller.cursor).toEqual([0, 0])
    expect(controller.status).toEqual(ExecutionStatus.Ready)
    expect(controller.currentPhase).toEqual(workflow.phases[0])
    expect(controller.currentAction).toEqual(workflow.phases[0].actions[0])
  })

  test('runNext() advances cursor and updates state correctly', async () => {
    const statusChanges: ExecutionStatus[] = []
    controller.on('status', status => statusChanges.push(status))
    await controller.runNext()
    expect(controller.cursor).toEqual([0, 1])
    expect(controller.status).toEqual(ExecutionStatus.Paused)
    expect(statusChanges).toEqual([ExecutionStatus.Running, ExecutionStatus.Paused])
    expect(controller.getPhaseResults(workflow.phases[0]).length).toBe(1)
    expect(controller.getPhaseResults(workflow.phases[1]).length).toBe(0)
  })

  test('runAll() executes all actions and completes', async () => {
    const statusChanges: ExecutionStatus[] = []
    controller.on('status', status => statusChanges.push(status))
    controller.on('error', console.log)
    await controller.runAll()
    expect(controller.cursor).toEqual([1, 1])
    expect(controller.status).toEqual(ExecutionStatus.Completed)
    expect(statusChanges).toEqual([ExecutionStatus.Running, ExecutionStatus.Completed])
    expect(controller.getPhaseResults(workflow.phases[0]).length).toBe(2)
    expect(controller.getPhaseResults(workflow.phases[1]).length).toBe(2)
  })

  test('pause() stops execution during runAll()', async () => {
    const statusChanges: ExecutionStatus[] = []
    controller.on('status', status => statusChanges.push(status))

    await controller.runAll((_result, cursor) => {
      if (cursor[0] === 0 && cursor[1] === 1) {
        controller.pause()
      }
    })

    expect(controller.cursor).toEqual([1, 0])
    expect(controller.status).toEqual(ExecutionStatus.Paused)
    expect(statusChanges).toEqual([ExecutionStatus.Running, ExecutionStatus.Paused])
    expect(controller.getPhaseResults(workflow.phases[0]).length).toBe(2)
    expect(controller.getPhaseResults(workflow.phases[1]).length).toBe(0)
  })

  test('rewindTo() moves cursor correctly and clears results', async () => {
    const statusChanges: ExecutionStatus[] = []
    controller.on('status', status => statusChanges.push(status))
    await controller.runAll()
    controller.rewindTo([0, 1])

    expect(controller.cursor).toEqual([0, 1])
    expect(controller.status).toEqual(ExecutionStatus.Paused)
    expect(statusChanges).toEqual([ExecutionStatus.Running, ExecutionStatus.Completed, ExecutionStatus.Paused])
    expect(controller.getPhaseResults(workflow.phases[0]).length).toBe(1)
    expect(controller.getPhaseResults(workflow.phases[1]).length).toBe(0)
  })

  test('reset() returns to initial state', async () => {
    const statusChanges: ExecutionStatus[] = []
    controller.on('status', status => statusChanges.push(status))
    await controller.runAll()
    controller.reset()

    expect(controller.cursor).toEqual([0, 0])
    expect(controller.status).toEqual(ExecutionStatus.Ready)
    expect(statusChanges).toEqual([ExecutionStatus.Running, ExecutionStatus.Completed, ExecutionStatus.Ready])
    expect(controller.getPhaseResults(workflow.phases[0]).length).toBe(0)
    expect(controller.getPhaseResults(workflow.phases[1]).length).toBe(0)
  })

  test('getCurrentContext() returns correct context', async () => {
    const contextKeys = () => Object.keys(controller.getCurrentContext())
    expect(contextKeys()).toEqual(['foo'])

    await controller.runNext()
    await controller.runNext()
    expect(contextKeys()).toEqual(['foo', 'a1', 'a2'])

    await controller.runAll()
    expect(contextKeys()).toEqual(['foo', 'a1', 'a2', 'b1', 'b2'])
  })

  test('getPhaseResults() returns correct results for a given phase', async () => {
    await controller.runAll()

    const results1 = controller.getPhaseResults(workflow.phases[0])
    const results2 = controller.getPhaseResults(workflow.phases[1])
    expect(results1.map(r => r.name)).toEqual(['a1', 'a2'])
    expect(results2.map(r => r.name)).toEqual(['b1', 'b2'])
  })

  test('getPhaseOutput() generates correct output for a phase', async () => {
    await controller.runAll()

    const output1 = controller.getPhaseOutput(workflow.phases[0])
    const output2 = controller.getPhaseOutput(workflow.phases[1])
    expect(output1).toBe(dd`
    Do a thing

    Result of A1

    Do another thing

    Result of A2
    `)
    expect(output2).toBe(dd`
    This is another phase

    Result of B1

    A final thing

    Result of B2

    Testing the suffix: Result of A1
    `)
  })

  test('getCompleteOutput() generates correct output for entire workflow', async () => {
    await controller.runAll()

    expect(controller.getCompleteOutput()).toBe(dd`
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

  test('Events are emitted correctly', async () => {
    let statusEvents = 0
    let actionEvents = 0
    let phaseEvents = 0
    let completeEvents = 0
    let errorEvents = 0
    let rewindEvents = 0

    controller.on('status', () => statusEvents++)
    controller.on('action', () => actionEvents++)
    controller.on('phase', () => phaseEvents++)
    controller.on('complete', () => completeEvents++)
    controller.on('error', () => errorEvents++)
    controller.on('error', console.error)
    controller.on('rewind', () => rewindEvents++)

    await controller.runAll()
    controller.reset()

    expect(statusEvents).toBe(3)
    expect(actionEvents).toBe(4)
    expect(phaseEvents).toBe(2)
    expect(completeEvents).toBe(1)
    expect(errorEvents).toBe(0)
    expect(rewindEvents).toBe(1)
  })

  test.todo('Error handling in runAll()', async () => {
    // Simulate an action that throws an error
    // Assert that the status changes to Error
    // Assert that execution stops and the error event is emitted
  })
})
