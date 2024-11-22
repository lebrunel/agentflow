import { unwrapContext } from '../context'
import type { Root } from 'mdast'
import type { ExecutionCursor } from './cursor'
import type { ActionHelpers } from '../action'
import type { WorkflowNode } from '../ast'
import type { Context, ContextValue, ContextValueMap } from '../context'

export class ExecutionState {
  #state: Map<string, ScopeState[]> = new Map()
  #visited: WeakSet<WorkflowNode> = new WeakSet()
  readonly actionLog: ActionResult[] = []

  getContext(cursor: ExecutionCursor): Context {
    return this.scoped(cursor, scope => {
      const results: Context = {}
      for (const { action } of scope.results.values()) {
        if (action) {
          results[action.contextKey] = action.result.value
        }
      }
      return {
        ...unwrapContext(scope.context),
        ...scope.helpers,
        ...results,
      }
    })
  }

  getResult(cursor: ExecutionCursor): StepResult | undefined {
    return this.scoped(cursor, scope => {
      return scope.results.get(cursor.location)
    })
  }

  *iterateResults(): Generator<StepResult> {
    const state = this.#state
    function* iterateScope(scopes?: ScopeState[]): Generator<StepResult> {
      if (!scopes) return

      for (const scope of scopes) {
        for (const result of scope.results.values()) {
          yield result

          const cursor = result.action?.cursor
          if (cursor && state.has(cursor.toString())) {
            yield* iterateScope(state.get(cursor.toString()))
          }
        }
      }
    }

    yield* iterateScope(this.#state.get('/'))
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

  visit(...nodes: WorkflowNode[]): void {
    for (const node of nodes) {
      this.#visited.add(node)
    }
  }

  visited(node: WorkflowNode): boolean {
    return this.#visited.has(node)
  }

  private scoped<T>(cursor: ExecutionCursor, callback: (scope: ScopeState) => T): T {
    const scopes = this.#state.get(cursor.path)
    const scope = (scopes || [])[cursor.iteration]
    if (!scope) throw new Error(`Scope not found: ${cursor.toString()}`)
    return callback(scope)
  }
}

// Types

export interface ScopeState {
  context: ContextValueMap;
  helpers: ActionHelpers;
  results: Map<string, StepResult>
}

export interface StepResult {
  content: Root;
  action?: ActionResult;
}

export interface ActionResult {
  cursor: ExecutionCursor;
  name: string;
  contextKey: string;
  result: ContextValue;
  meta?: { type: string, data: any }
}
