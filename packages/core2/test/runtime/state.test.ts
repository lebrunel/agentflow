import { beforeEach, describe, expect, test } from 'bun:test'
import { runtime } from 'test/support/runtime'

import { compileSync, util, ExecutionState, type ContextValueMap } from '~/index'

const { dd } = util

const src = dd`
---
inputs:
  name:
    type: text
---

# Hello

This is an introduction

---

Do a thing

<Mock name="a1" type="text" value="Result of A1" />

Do another thing

<Mock name="a2" type="text" value="Result of A2" />

---

This is another phase

<Mock name="b1" type="text" value="Result of B1" />

A final thing

<Mock name="b2" type="text" value="Result of B2" />
`
const file = compileSync(src, { runtime })
const workflow = file.result

describe('ExecutionState', () => {
  let context: ContextValueMap
  let state: ExecutionState

  beforeEach(() => {
    context = { foo: { type: 'text', value: 'bar' } }
    state = new ExecutionState(workflow, context)
  })

  function pushResult(name: string) {
    state.pushResult({
      type: 'mock',
      name,
      input: { type: 'text', value: 'input' },
      output: { type: 'text', value: name },
    })
  }

  test('initializes with correct state', () => {
    expect(state.cursor).toEqual([0, 0])
    expect(state.phaseSizeMap.size).toBe(2)
    expect(state.resultMap.size).toBe(2)
    expect(state.resultLog.length).toBe(0)

    for (const phaseSize of state.phaseSizeMap.values()) {
      expect(phaseSize).toBe(2)
    }
    for (const values of state.resultMap.values()) {
      expect(values).toEqual([])
    }
  })

  test('advanceCursor() moves cursor correctly', () => {
    expect(state.cursor).toEqual([0, 0])
    state.advanceCursor()
    expect(state.cursor).toEqual([0, 1])
    state.advanceCursor()
    expect(state.cursor).toEqual([1, 0])
    state.advanceCursor()
    expect(state.cursor).toEqual([1, 1])
  })

  test('rewindCursor() moves cursor and clears results', () => {
    pushResult('a1')
    state.advanceCursor()
    pushResult('a2')
    state.advanceCursor()

    expect(state.cursor).toEqual([1, 0])
    expect(state.resultMap.get(0)?.length).toBe(2)
    expect(state.resultMap.get(0)?.map(r => r.name)).toContain('a2')
    expect(state.resultLog.length).toBe(2)

    state.rewindCursor([0, 1])
    expect(state.cursor).toEqual([0, 1])
    expect(state.resultMap.get(0)?.length).toBe(1)
    expect(state.resultMap.get(0)?.map(r => r.name)).not.toContain('a2')

    state.rewindCursor([0, 0])
    expect(state.cursor).toEqual([0, 0])
    expect(state.resultMap.get(0)?.length).toBe(0)
    expect(state.resultLog.length).toBe(2)
  })

  test('getContext() returns correct context', () => {
    const initialContext = state.getContext()
    expect(initialContext).toEqual(context)

    pushResult('a1')
    state.advanceCursor()
    pushResult('a2')
    state.advanceCursor()

    const currentContext = state.getContext()
    expect(currentContext.a1).toEqual({ type: 'text', value: 'a1' })
    expect(currentContext.a2).toEqual({ type: 'text', value: 'a2' })
  })

  test('pushResult() adds result to correct phase and log', () => {
    expect(state.resultMap.get(0)?.length).toBe(0)
    expect(state.resultLog.length).toBe(0)

    pushResult('a1')
    state.advanceCursor()
    pushResult('a2')
    state.advanceCursor()
    pushResult('b1')

    expect(state.resultMap.get(0)?.length).toBe(2)
    expect(state.resultMap.get(1)?.length).toBe(1)
    expect(state.resultLog.length).toBe(3)
  })

  test('isFirstAction and isLastAction work correctly', () => {
    expect(state.isFirstAction).toBeTrue()
    expect(state.isLastAction).toBeFalse()

    state.advanceCursor()
    expect(state.isFirstAction).toBeFalse()
    expect(state.isLastAction).toBeFalse()

    state.advanceCursor()
    state.advanceCursor()
    state.advanceCursor()
    expect(state.isFirstAction).toBeFalse()
    expect(state.isLastAction).toBeTrue()
  })

  test('getPhaseSize() returns correct size for each phase', () => {
    expect(state.getPhaseSize(0)).toBe(2)
    expect(state.getPhaseSize(1)).toBe(2)
  })
})
