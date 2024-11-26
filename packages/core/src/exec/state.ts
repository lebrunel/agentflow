import { unwrapContext } from '../context'
import { ExecutionCursor, parseLocation, type CursorLocation } from './cursor'
import type { ActionHelpers } from '../action'
import type { WorkflowNode } from '../ast'
import type { Context, ContextValue, ContextValueMap } from '../context'

export class ExecutionState {
  #state: Map<string, ExecutionScope[]> = new Map()
  #visited: WeakSet<WorkflowNode> = new WeakSet()
  readonly actionLog: ActionResult[] = []

  getContext(cursor: ExecutionCursor): Context {
    return this.scoped(cursor, scope => {
      return {
        ...unwrapContext(scope.context),
        ...scope.helpers,
        ...extractResults(scope.results.values()),
      }
    })
  }

  getScope(cursor: ExecutionCursor): ExecutionScope {
    return this.scoped(cursor, scope => scope)
  }

  getScopeResults(cursor: ExecutionCursor): StepResult[][] {
    const scopes = this.#state.get(cursor.path) || []
    return scopes.map(scope => {
      return Array.from(scope.results.values())
    })
  }

  getPhaseResults(cursor: ExecutionCursor): StepResult[] {
    return this.scoped(cursor, scope => {
      const results: StepResult[] = []
      for (const [loc, result] of scope.results) {
        if (parseLocation(loc).phaseIndex === cursor.phaseIndex) {
          results.push(result)
        }
      }
      return results
    })
  }

  getStepResult(cursor: ExecutionCursor): StepResult | undefined {
    return this.scoped(cursor, scope => {
      return scope.results.get(cursor.location)
    })
  }

  *iterateResults(): Generator<[ExecutionCursor, StepResult]> {
    const state = this.#state

    function* iterate(cursor: ExecutionCursor): Generator<[ExecutionCursor, StepResult]> {
      const scopes = state.get(cursor.path)
      if (!scopes) return

      for (const scope of scopes) {
        for (const [location, result] of scope.results) {
          const cursorLocation = location.split('.').map(Number) as CursorLocation
          const currentCursor = ExecutionCursor.move(cursor, cursorLocation)
          yield [currentCursor, result]

          const nextCursor = result.action?.cursor
          if (nextCursor && state.has(nextCursor.toString())) {
            yield* iterate(ExecutionCursor.push(currentCursor))
          }
        }
      }
    }

    yield* iterate(new ExecutionCursor())
  }

  pushContext(
    cursor: ExecutionCursor,
    context: ContextValueMap,
    helpers: ActionHelpers = {},
  ): void {
    let scopes = this.#state.get(cursor.path)
    const results = new Map()

    if (!scopes) {
      scopes = []
      this.#state.set(cursor.path, scopes)
    }

    if (scopes[cursor.iteration]) {
      throw new Error(`Duplicate scope: ${cursor.toString()}`)
    } else  if (scopes.length !== cursor.iteration) {
      throw new Error(`Invalid iteration: ${cursor.toString()}`)
    }

    scopes[cursor.iteration] = { context, helpers, results }
  }

  pushResult(cursor: ExecutionCursor, result: StepResult): void {
    this.scoped(cursor, scope => {
      if (scope.results.has(cursor.location)) {
        throw new Error(`Duplicate result: ${cursor.toString()}`)
      }
      scope.results.set(cursor.location, result)
    })
    if (result.action) {
      this.actionLog.push(result.action)
    }
  }

  rewind(cursor: ExecutionCursor): void {
    // drop future scopes
    clearMap(this.#state, cursor.path)

    // drop results from current location
    const scopes = this.#state.get(cursor.path)
    if (scopes && scopes[cursor.iteration]) {
      clearMap(scopes[cursor.iteration].results, cursor.location, true)
    }
  }

  visit(...nodes: WorkflowNode[]): void {
    for (const node of nodes) {
      this.#visited.add(node)
    }
  }

  visited(node: WorkflowNode): boolean {
    return this.#visited.has(node)
  }

  private scoped<T>(cursor: ExecutionCursor, callback: (scope: ExecutionScope) => T): T {
    const scopes = this.#state.get(cursor.path)
    const scope = (scopes || [])[cursor.iteration]
    if (!scope) throw new Error(`Scope not found: ${cursor.toString()}`)
    return callback(scope)
  }
}

export function extractResults(steps: Iterable<StepResult>): Context {
  const results: Context = {}
  for (const { action } of steps) {
    if (action) {
      results[action.contextKey] = action.result.value
    }
  }
  return results
}

function clearMap<K, V>(map: Map<K, V>, key: string, fromFrom: boolean = false): boolean {
  let keyFound = false
  for (const k of map.keys()) {
    if (keyFound) {
      map.delete(k)
    } else if (k === key) {
      keyFound = true
      if (fromFrom) map.delete(k)
    }
  }
  return keyFound
}

// Types

export interface ExecutionScope {
  context: ContextValueMap;
  helpers: ActionHelpers;
  results: Map<string, StepResult>
}

export interface StepResult {
  content: string;
  action?: ActionResult;
}

export interface ActionResult {
  cursor: ExecutionCursor;
  name: string;
  contextKey: string;
  result: ContextValue;
  meta?: ActionMeta;
};

export interface ActionMeta<T = any> {
  type: string;
  data: T
}
