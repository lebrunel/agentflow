import { ExecutionCursor, parseLocation } from './cursor'

import type { ActionLog } from '../action'
import type { ContextValueMap } from '../context'

export class ExecutionState {
  readonly stateMap: Map<string, ExecutionScope[]> = new Map()
  readonly actionLog: ActionLog[] = []

  getAllContexts(cursor: ExecutionCursor): ContextValueMap[] {
    const scopes = this.stateMap.get(cursor.path) || []
    return scopes.map(extractContext)
  }

  getContext(cursor: ExecutionCursor): ContextValueMap {
    return this.scoped(cursor, extractContext)
  }

  getComputed(cursor: ExecutionCursor): Record<string, any> {
    return this.scoped(cursor, scope => {
      return scope.computed
    })
  }

  getScopeResults(cursor: ExecutionCursor): ActionLog[] {
    return this.scoped(cursor, scope => {
      return [...scope.results.values()]
    })
  }

  getPhaseResults(cursor: ExecutionCursor): ActionLog[] {
    return this.scoped(cursor, scope => {
      const results: ActionLog[] = []
      for (const [location, result] of scope.results) {
        const loc = parseLocation(location)
        if (
          loc.iteration === cursor.iteration &&
          loc.phaseIndex === cursor.phaseIndex
        ) {
          results.push(result)
        }
      }
      return results
    })
  }

  getActionResult(cursor: ExecutionCursor): ActionLog | undefined {
    return this.scoped(cursor, scope => {
      return scope.results.get(cursor.location)
    })
  }

  /**
   * Pushes a new scope with the given context onto the state map
   */
  pushContext(cursor: ExecutionCursor, context: ContextValueMap, computed: Record<string, any> = {}): void {
    let scopes = this.stateMap.get(cursor.path)

    if (!scopes) {
      scopes = []
      this.stateMap.set(cursor.path, scopes)
    }

    scopes[cursor.iteration] = {
      context,
      computed,
      results: new Map<string, ActionLog>(),
    }
  }

  pushResult(cursor: ExecutionCursor, result: ActionLog): void {
    this.scoped(cursor, scope => {
      scope.results.set(cursor.location, result)
    })
  }

  dropResultsFrom(cursor: ExecutionCursor): void {
    // drop future scopes
    dropFromKey(this.stateMap, cursor.path)

    // drop results from current location
    const scopes = this.stateMap.get(cursor.path)
    const scope = (scopes || [])[cursor.iteration]
    if (scope) {
      dropFromKey(scope.results, cursor.location, true)
    }
  }

  private scoped<T>(cursor: ExecutionCursor, callback: (scope: ExecutionScope) => T): T {
    const scopes = this.stateMap.get(cursor.path)
    const scope = (scopes || [])[cursor.iteration]
    if (!scope) throw new Error(`Scope not found: ${cursor.toString()}`)
    return callback(scope)
  }
}

function dropFromKey<K, V>(map: Map<K, V>, key: string, dropKey: boolean = false): boolean {
  let keyFound = false
  for (const k of map.keys()) {
    if (keyFound) {
      map.delete(k)
    } else if (k === key) {
      keyFound = true
      if (dropKey) map.delete(k)
    }
  }
  return keyFound
}

function extractContext(scope: ExecutionScope): ContextValueMap {
  const context = { ...scope.context }
  for (const result of scope.results.values()) {
    context[result.contextKey] = { ...result.output }
  }
  return context
}

// types

interface ExecutionScope {
  context: ContextValueMap;
  computed: Record<string, any>;
  results: Map<string, ActionLog>
}
