import { unwrapContext } from '../context'
import { ExecutionCursor, parseLocation, type CursorLocation } from './cursor'
import type { ActionHelpers } from '../action'
import type { WorkflowNode } from '../ast'
import type { Context, ContextValue, ContextValueMap } from '../context'

/**
 * Manages the state of a workflow during secution, managing context, tracking
 * results and visited node history.
 */
export class ExecutionState {
  #state: Map<string, ExecutionScope[]> = new Map()
  #visited: WeakSet<WorkflowNode> = new WeakSet()
  readonly actionLog: ActionResult[] = []

  /**
   * Returns the state of the current scope at the given cursor location.
   * Context, helpers and action results from the current scope are flattened
   * into a single context object.
   */
  getContext(cursor: ExecutionCursor): Context {
    return this.scoped(cursor, scope => {
      return {
        ...unwrapContext(scope.context),
        ...scope.helpers,
        ...extractResults(scope.results.values()),
      }
    })
  }

  /**
   * Returns a single execution scope for the given cursor location.
   */
  getScope(cursor: ExecutionCursor): ExecutionScope {
    return this.scoped(cursor, scope => scope)
  }

  /**
   * Returns all step results from every scope iteration at the given cursor
   * path. Returns an array of arrays as each iteration scope contains multiple
   * step results.
   */
  getScopeResults(cursor: ExecutionCursor): StepResult[][] {
    const scopes = this.#state.get(cursor.path) || []
    return scopes.map(scope => {
      return Array.from(scope.results.values())
    })
  }

  /**
   * Returns all step results for the specific phase indicated by the cursor
   * from the current scope. Filters results to only include those matching the
   * cursor's phaseIndex.
   */
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

  /**
   * Returns the result of a specific step based on the given cursor location.
   */
  getStepResult(cursor: ExecutionCursor): StepResult | undefined {
    return this.scoped(cursor, scope => {
      return scope.results.get(cursor.location)
    })
  }

  /**
   * Returns a flattened iterator of execution results traversing through all
   * scopes. Each yielded value contains the cursor location and the
   * corresponding step result.
   */
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

  /**
   * Adds a new execution scope to the state at the given cursor location. The
   * new scope contains the provided context for variable storage, action
   * helpers, and an empty results map for tracking step results.
   */
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

  /**
   * Stores a step result at the cursor location in the current scope. Only one
   * result can exist per cursor until rewind() clears it. If the result
   * contains an action, appends it to the action log which persists across
   * rewinds.
   */
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

  /**
   * Removes execution scopes and step results that occur after the given cursor
   * location. Rewinds the results back to a previous state keeping. The action
   * log is kept intact.
   */
  rewind(cursor: ExecutionCursor): void {
    // drop future scopes
    clearMap(this.#state, cursor.path)

    // drop results from current location
    const scopes = this.#state.get(cursor.path)
    if (scopes && scopes[cursor.iteration]) {
      clearMap(scopes[cursor.iteration].results, cursor.location, true)
    }
  }

  /**
   * Tracks nodes that have been executed in this workflow run. Used to detect
   * cycles and avoid re-running completed steps.
   */
  visit(...nodes: WorkflowNode[]): void {
    for (const node of nodes) {
      this.#visited.add(node)
    }
  }

  /**
   * Returns whether a given node has been visited during workflow execution.
   */
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

function extractResults(steps: Iterable<StepResult>): Context {
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
    if (k === key) {
      keyFound = true
      if (fromFrom) map.delete(k)
      continue
    }

    if (keyFound) map.delete(k)
  }
  return keyFound
}

// Types

/**
 * Represents a single iteration of a workflow scope during execution. Stores
 * context, helpers and step results for one specific iteration of a scope.
 */
export interface ExecutionScope {
  context: ContextValueMap;
  helpers: ActionHelpers;
  results: Map<string, StepResult>
}

/**
 * Represents a single unit of execution, combining content output with an
 * optional action result.
 */
export interface StepResult {
  //content: string;
  content: ContextValue[];
  action?: ActionResult;
}

/**
 * Represents the result of executing an action in the workflow including
 * identifying information and the resulting value to be stored in context.
 */
export interface ActionResult {
  cursor: ExecutionCursor;
  name: string;
  contextKey: string;
  result: ContextValue;
  meta?: ActionMeta;
};

/**
 * Optional metadata associated with action results, containing a type identifier
 * and structured data. Typically used to store raw responses and metadate.
 */
export interface ActionMeta<T = any> {
  type: string;
  data: T
}
