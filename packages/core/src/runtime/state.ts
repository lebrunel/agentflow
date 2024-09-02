import { compareCursors, stringifyCursor } from './cursor'
import { ExecutionScope } from './scope'

import type { ExecutionCursor, Cursor } from './cursor'
import type { ContextValueMap } from '../context'
import type { Workflow, WorkflowPhase } from '../workflow'

export class ExecutionState {
  #cursor: ExecutionCursor
  status: ExecutionStatus
  scopes: ScopeMap

  constructor(workflow: Workflow, context: ContextValueMap) {
    this.status = ExecutionStatus.Ready
    this.#cursor = [[0,0,0]]
    this.scopes = new ScopeMap(
      new ExecutionScope(workflow.phases, context)
    )
  }

  get cursor(): ExecutionCursor {
    return this.#cursor.map(c => [...c])
  }

  get cursorHead(): Cursor {
    return this.cursor[0]
  }

  get cursorTail(): Cursor {
    return this.cursor[this.cursor.length - 1]
  }

  get currentScope(): ExecutionScope {
    return this.scopes.get(this.cursor)
  }

  get isScopeStart(): boolean {
    const tail = this.cursorTail
    return tail[1] === 0 &&
           tail[2] === 0
  }

  get isScopeEnd(): boolean {
    const tail = this.cursorTail
    const maxPhaseIndex = this.currentScope.phaseCount - 1
    return tail[1] === maxPhaseIndex &&
           tail[2] === this.currentScope.getPhaseSize(maxPhaseIndex) - 1
  }

  /**
   * Moves the cursor to the next action or phase.
   */
  advanceCursor(): void {
    const tail = this.cursorTail
    if (tail[2] < this.currentScope.getPhaseSize(tail[1]) - 1) {
      tail[2]++
    } else if (tail[1] < this.currentScope.phaseSizeMap.size - 1) {
      tail[1]++
      tail[2] = 0
    }

    this.#cursor.splice(-1, 1, tail)
  }

  /**
   * Moves the cursor to a previous position and clears subsequent results.
   */
  rewindCursor(cursor: ExecutionCursor) {
    if (cursor.some(c => c.some(n => n < 0))) {
      throw new Error(`Cursor cannot have negative index: ${JSON.stringify(cursor)}`)
    } else if (
      compareCursors(cursor, this.cursor) > -1
    ) {
      throw new Error(`Invalid cursor for rewind: ${JSON.stringify(cursor)}`)
    }

    this.#cursor = cursor

    // Clear scopes in avance of the new cursor
    this.scopes.clearFrom(cursor)

    // Clear results from the current scope, in advance of the cursor
    const tail = this.cursorTail
    for (const [phaseIdx, results] of this.currentScope.resultMap) {
      if (phaseIdx > tail[1]) {
        results.splice(0)
      } else if (phaseIdx === tail[1]) {
        results.splice(tail[2])
      }
    }
  }

  private set cursor(cursor: ExecutionCursor) {
    this.#cursor = cursor.map(c => [...c])
  }

}







class ScopeMap {
  #map: Map<string, ExecutionScope> = new Map()

  constructor(rootScope: ExecutionScope) {
    this.#map.set('/', rootScope)
  }

  [Symbol.iterator](): IterableIterator<[string, ExecutionScope]> {
    return this.#map[Symbol.iterator]()
  }

  clearFrom(cursor: ExecutionCursor): void {
    const fromKey = this.toKey(cursor)
    for (const key of this.#map.keys()) {
      if (fromKey < key) {
        this.#map.delete(key)
      }
    }
  }

  get(cursor: ExecutionCursor): ExecutionScope {
    return this.#map.get(this.toKey(cursor))!
  }

  has(cursor: ExecutionCursor): boolean {
    return this.#map.has(this.toKey(cursor))
  }

  //keys(): Iterable<string> {
  //  return this.#map.keys()
  //}

  set(cursor: ExecutionCursor, scope: ExecutionScope): void {
    this.#map.set(this.toKey(cursor), scope)
  }

  private toKey(cursor: ExecutionCursor): string {
    return stringifyCursor(cursor, true)
  }
}


/**
 * Represents the current state of workflow execution.
 */
export enum ExecutionStatus {
  /** Initial state, cursor at [0,0] */
  Ready,

  /** Workflow is in progress */
  Running,

  /** Execution paused, waiting for next action */
  Paused,

  /** All actions executed successfully */
  Completed,

  /** An error occurred during execution */
  Error,
}
