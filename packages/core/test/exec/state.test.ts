import { beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import dd from 'ts-dedent'
import { ExecutionCursor, ExecutionState } from 'src/exec'
import { Workflow } from 'src/workflow'

import type { PrimitiveContextValue } from 'src/context'
import type { StepResult } from 'src/exec'

let state: ExecutionState

beforeEach(() => {
  state = new ExecutionState()
})

function ctx(key: string, value: string | number): { [key: string]: PrimitiveContextValue } {
  return { [key]: { type: 'primitive', value } }
}

function mock(cursor: ExecutionCursor, contextKey: string, value: string | number): StepResult {
  return {
    content: { type: 'root', children: [] },
    action: { cursor, contextKey, name: 'mock', result: { type: 'primitive', value }}
  }
}

describe('ExecutionState', () => {
  test('by default initates an empty state', () => {
    expect([...state.iterateResults()]).toBeEmpty()
    expect(state.actionLog).toBeEmpty()
  })

  test('getContext() throws if unknown context', () => {
    expect(() => {
      state.getContext(ExecutionCursor.parse('/0.0.0'))
    }).toThrow(/scope not found/i)
  })

  test('getContext() returns unwrapped context and helpers', () => {
    state.pushContext(ExecutionCursor.parse('/0.0.0'), ctx('a', 1), { $: 'foo' })
    expect(state.getContext(ExecutionCursor.parse('/0.0.0'))).toEqual({ a: 1, $: 'foo' })
  })
})

describe('ExecutionState pushContext()', () => {
  test('pushes a new execution context', () => {
    state.pushContext(ExecutionCursor.parse('/0.0.0'), ctx('a', 1))
    expect(state.getContext(ExecutionCursor.parse('/0.0.0'))).toEqual({ a: 1 })
  })

  test('accepts multiple iterations of same scope', () => {
    state.pushContext(ExecutionCursor.parse('/0.0.0'), ctx('a', 1))
    state.pushContext(ExecutionCursor.parse('/1.0.0'), ctx('a', 2))
    expect(state.getContext(ExecutionCursor.parse('/0.0.0'))).toEqual({ a: 1 })
    expect(state.getContext(ExecutionCursor.parse('/1.0.0'))).toEqual({ a: 2 })
  })

  test('throws if same scope/iteration exists', () => {
    state.pushContext(ExecutionCursor.parse('/0.0.0'), {})
    expect(() => {
      state.pushContext(ExecutionCursor.parse('/0.0.1'), {})
    }).toThrow(/duplicate scope/i)
  })

  test('throws if iteration out of order', () => {
    state.pushContext(ExecutionCursor.parse('/0.0.0'), {})
    expect(() => {
      state.pushContext(ExecutionCursor.parse('/99.0.0'), {})
    }).toThrow(/invalid iteration/i)
  })
})

describe('ExecutionState pushResult()', () => {
  test('pushes a new step result', () => {
    const c0 = ExecutionCursor.parse('/0.0.0')
    const c1 = ExecutionCursor.move(c0, [0, 0, 1])

    state.pushContext(c0, {})
    state.pushResult(c0, mock(c0, 'x', 1))
    state.pushResult(c1, mock(c1, 'y', 2))

    const r0 = state.getResult(c0)
    expect(r0?.action?.cursor).toEqual(c0)
    expect(r0?.action?.contextKey).toEqual('x')
    expect(r0?.action?.result.value).toEqual(1)

    const r1 = state.getResult(c1)
    expect(r1?.action?.cursor).toEqual(c1)
    expect(r1?.action?.contextKey).toEqual('y')
    expect(r1?.action?.result.value).toEqual(2)
  })

  test('throws on duplicate cursor', () => {
    const c0 = ExecutionCursor.parse('/0.0.0')
    state.pushContext(c0, {})
    state.pushResult(c0, mock(c0, 'x', 1))
    expect(() => {
      state.pushResult(c0, mock(c0, 'y', 2))
    }).toThrow(/duplicate result/i)
  })
})

describe('ExecutionState iterateResults()', () => {
  test.todo('iterates through step results in order')
  test.todo('flattens nested scopes in normalised order')
})

describe('ExecutionState visit()', () => {
  let workflow: Workflow
  beforeAll(() => {
    workflow = Workflow.compileSync(dd`
    Foo

    <Mock as="a" value="aaa" />

    Bar

    ---

    <Loop as="b" until={$.index === 3}>
      Baz
    </Loop>
    `)
  })

  test('collects scopes', () => {
    const scope = workflow.view
    expect(state.visited(scope)).toBeFalse()
    state.visit(scope)
    expect(state.visited(scope)).toBeTrue()
  })

  test('collects phases', () => {
    const scope = workflow.view
    expect(state.visited(scope.phases[0])).toBeFalse()
    expect(state.visited(scope.phases[1])).toBeFalse()
    state.visit(...scope.phases)
    expect(state.visited(scope.phases[0])).toBeTrue()
    expect(state.visited(scope.phases[1])).toBeTrue()
  })

  test('collects steps', () => {
    const scope = workflow.view
    expect(state.visited(scope.phases[0].steps[0])).toBeFalse()
    expect(state.visited(scope.phases[1].steps[0])).toBeFalse()
    state.visit(...scope.phases[0].steps)
    state.visit(...scope.phases[1].steps)
    expect(state.visited(scope.phases[0].steps[0])).toBeTrue()
    expect(state.visited(scope.phases[1].steps[0])).toBeTrue()
  })

  test('ignores duplicates', () => {
    const scope = workflow.view
    expect(state.visited(scope)).toBeFalse()
    state.visit(scope)
    state.visit(scope)
    state.visit(scope)
    expect(state.visited(scope)).toBeTrue()
  })
})
