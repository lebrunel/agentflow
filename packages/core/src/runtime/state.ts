import { ExecutionCursor, parseLocation } from './cursor'

import type { ActionMeta } from '../action'
import type { ContextValue, ContextValueMap } from '../context'

export class ExecutionState {
  readonly stateMap: Map<string, ExecutionScope> = new Map()
  readonly actionLog: ActionLog[] = []

  getExecutionScope(cursor: ExecutionCursor): ExecutionScope {
    return this.scoped(cursor, scope => scope)
  }

  getContext(cursor: ExecutionCursor): ContextValueMap {
    return this.scoped(cursor, scope => {
      const context = { ...scope.context }
      for (const result of scope.results.values()) {
        context[result.contextKey] = { ...result.output }
      }
      return context
    })
  }

  getScopeResults(cursor: ExecutionCursor): ActionLog[] {
    return this.scoped(cursor, scope => {
      return [...scope.results.values()]
    })
  }

  getGroupedScopeResults(cursor: ExecutionCursor): ActionLog[][] {
    return this.scoped(cursor, scope => {
      const groupMap: Map<string, ActionLog[]> = new Map()

      for (const [location, actionLog] of scope.results) {
        const key = location.replace(/\.\d+$/, '')

        let group = groupMap.get(key)

        if (!group) {
          group = []
          groupMap.set(key, group)
        }

        group.push(actionLog)
      }

      return Array.from(groupMap.values())
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
  pushContext(cursor: ExecutionCursor, context: ContextValueMap): void {
    this.stateMap.set(cursor.path, {
      context,
      results: new Map<string, ActionLog>(),
    })
  }

  pushResult(cursor: ExecutionCursor, result: ActionLog): void {
    this.scoped(cursor, scope => {
      scope.results.set(cursor.location, result)
    })
  }

  dropResultsFrom(cursor: ExecutionCursor): void {
    // drop future scopes
    dropFromKey(cursor.path, this.stateMap)
    const scope = this.stateMap.get(cursor.path)
    if (scope) {
      // drop results from current location
      dropFromKey(cursor.location, scope.results, true)
    }
  }

  private scoped<T>(cursor: ExecutionCursor, callback: (scope: ExecutionScope) => T): T {
    const scope = this.stateMap.get(cursor.path)
    if (!scope) throw new Error(`Scope not found: ${cursor.toString()}`)
    return callback(scope)
  }
}

function dropFromKey<K, V>(key: string, map: Map<K, V>, dropKey: boolean = false): boolean {
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



/// types

interface ExecutionScope {
  context: ContextValueMap;
  results: Map<string, ActionLog>
}

interface GroupedExecutionScope {
  context: ContextValueMap;
  results: ActionLog[][]
}

export interface ActionLog {
  cursor: string;
  actionName: string;
  contextKey: string;
  input: ContextValue[];
  output: ContextValue;
  meta: ActionMeta;
}
