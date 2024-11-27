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
    content: 'test',
    action: { cursor, contextKey, name: 'mock', result: { type: 'primitive', value }}
  }
}

describe('ExecutionState', () => {
  test('by default initates an empty state', () => {
    expect([...state.iterateResults()]).toBeEmpty()
    expect(state.actionLog).toBeEmpty()
  })
})

describe('ExecutionState getContext()', () => {
  test('returns unwrapped context and helpers', () => {
    state.pushContext(ExecutionCursor.parse('/0.0.0'), ctx('a', 1), { $: 'foo' })
    expect(state.getContext(ExecutionCursor.parse('/0.0.0'))).toEqual({ a: 1, $: 'foo' })
  })

  test('throws if unknown scope', () => {
    expect(() => {
      state.getContext(ExecutionCursor.parse('/0.0.0'))
    }).toThrow(/scope not found/i)
  })
})

describe('ExecutionState getScope()', () => {
  test('returns execution scope of the specific iteration', () => {
    const cursor = ExecutionCursor.parse('/0.0.0')
    state.pushContext(cursor, {})
    state.pushResult(cursor, mock(cursor, 'foo', 'bar'))
    const scope = state.getScope(cursor)
    expect(scope.results.has('0.0.0')).toBeTrue()
  })

  test('throws if unknown scope', () => {
    expect(() => {
      state.getScope(ExecutionCursor.parse('/0.0.0'))
    }).toThrow(/scope not found/i)
  })
})

describe('ExecutionState getScopeResults()', () => {
  test('returns all step results from every iteration of the scope', () => {
    let cursor = ExecutionCursor.parse('/0.0.0')
    for (const i of [0,1,2]) {
      cursor = ExecutionCursor.move(cursor, [i,0,0])
      state.pushContext(cursor, {})
      state.pushResult(cursor, mock(cursor, 'foo', i))
      cursor = ExecutionCursor.move(cursor, [i,0,1])
      state.pushResult(cursor, mock(cursor, 'bar', i))
      cursor = ExecutionCursor.move(cursor, [i,0,2])
      state.pushResult(cursor, mock(cursor, 'qux', i))
    }

    const results = state.getScopeResults(ExecutionCursor.parse('/0.0.0'))
    expect(results).toHaveLength(3)

    for (const block of results) {
      expect(block).toHaveLength(3)
      for (const result of block) {
        expect(result.content).toBeString()
        expect(result.action).toBeObject()
      }
    }
  })

  test('wont throw if unknown scope', () => {
    expect(() => {
      state.getScopeResults(ExecutionCursor.parse('/0.0.0'))
    }).not.toThrow()
  })
})

describe('ExecutionState getPhaseResults()', () => {
  test('returns all step results for the given phase', () => {
    let cursor = ExecutionCursor.parse('/0.0.0')
    state.pushContext(cursor, {})
    state.pushResult(cursor, mock(cursor, 'foo', 1))
    cursor = ExecutionCursor.move(cursor, [0,0,1])
    state.pushResult(cursor, mock(cursor, 'bar', 2))
    // move the phase
    cursor = ExecutionCursor.move(cursor, [0,1,0])
    state.pushResult(cursor, mock(cursor, 'qux', 3))

    const results = state.getPhaseResults(ExecutionCursor.parse('/0.0.0'))
    expect(results).toHaveLength(2)
    expect(results.some(r => r.action!.contextKey === 'foo')).toBeTrue()
    expect(results.some(r => r.action!.contextKey === 'bar')).toBeTrue()
    expect(results.some(r => r.action!.contextKey === 'qux')).toBeFalse()
  })

  test('throws if unknown scope', () => {
    expect(() => {
      state.getPhaseResults(ExecutionCursor.parse('/0.0.0'))
    }).toThrow(/scope not found/i)
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

    const r0 = state.getStepResult(c0)
    expect(r0?.action?.cursor).toEqual(c0)
    expect(r0?.action?.contextKey).toEqual('x')
    expect(r0?.action?.result.value).toEqual(1)

    const r1 = state.getStepResult(c1)
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

describe('ExecutionState rewind()', () => {
  test('clears future scopes from the state', () => {
    state.pushContext(ExecutionCursor.parse('/0.0.0'), {})
    state.pushContext(ExecutionCursor.parse('/0.0.0/0.0.0'), {})
    state.pushContext(ExecutionCursor.parse('/0.0.1/0.0.0'), {})
    state.pushContext(ExecutionCursor.parse('/0.0.2/0.0.0'), {})

    let cursor = ExecutionCursor.parse('/0.0.2')
    state.pushResult(cursor, mock(cursor, 'foo', 1))

    cursor = ExecutionCursor.push(cursor)
    for (const i of [0,1,2]) {
      cursor = ExecutionCursor.move(cursor, [0,0,i])
      state.pushResult(cursor, mock(cursor, 'foo', 1))
    }

    expect([...state.iterateResults()]).toHaveLength(4)
    expect(state.actionLog).toHaveLength(4)

    state.rewind(ExecutionCursor.parse('/0.0.1'))

    expect([...state.iterateResults()]).toHaveLength(1)
    expect(state.actionLog).toHaveLength(4)
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
