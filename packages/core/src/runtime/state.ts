import type { ActionResultLog } from '../action'
import type { ContextValueMap } from '../context'
import type { Workflow } from '../workflow'

/**
 * Maintains the state of a workflow execution.
 */
export class ExecutionState {
  #cursor: ExecutionCursor = [0, 0]
  status: ExecutionStatus = ExecutionStatus.Ready

  initialContext: ContextValueMap
  phaseSizeMap: Map<number, number> = new Map()
  resultMap: Map<number, ActionResultLog[]> = new Map()
  resultLog: ActionResultLog[] = []

  constructor(workflow: Workflow, context: ContextValueMap) {
    // iterate over phases to populate size map and result map
    for (let i = 0; i < workflow.phases.length; i++) {
      const phase = workflow.phases[i]
      this.phaseSizeMap.set(i, phase.actions.length)
      this.resultMap.set(i, [])
    }
    this.initialContext = {...context}
  }

  /** The current position in the workflow, represented as [phaseIndex, actionIndex]. */
  get cursor(): ExecutionCursor {
    return [...this.#cursor]
  }

  /** The total number of phases in the workflow. */
  get phaseCount(): number {
    return this.phaseSizeMap.size
  }

  /** Indicates if the cursor is at the first action of the first phase. */
  get isFirstAction(): boolean {
    return this.cursor.every(n => n === 0)
  }

  /** Indicates if the cursor is at the last action of the last phase. */
  get isLastAction(): boolean {
    return this.cursor[0] === this.phaseCount - 1 &&
           this.cursor[1] === this.getPhaseSize() - 1
  }

  /**
   * Moves the cursor to the next action or phase.
   */
  advanceCursor(): void {
    if (this.cursor[1] < this.getPhaseSize() - 1) {
      this.cursor = [this.cursor[0], this.cursor[1] + 1]
    } else if (this.cursor[0] < this.phaseSizeMap.size - 1) {
      this.cursor = [this.cursor[0] + 1, 0]
    }
  }

  /**
   * Moves the cursor to a previous position and clears subsequent results.
   */
  rewindCursor(cursor: ExecutionCursor) {
    if (cursor.some(n => n < 0)) {
      throw new Error(`Cursor cannot have negative index: ${JSON.stringify(cursor)}`)
    } else if (
      cursor[0] > this.cursor[0] ||
      (cursor[0] === this.cursor[0] && cursor[1] > this.cursor[1])
    ) {
      throw new Error(`Invalid cursor for rewind: ${JSON.stringify(cursor)}`)
    }

    this.cursor = cursor

    // Clear results
    for (const [phaseIdx, results] of this.resultMap) {
      if (phaseIdx > cursor[0]) {
        results.splice(0)
      } else if (phaseIdx === cursor[0]) {
        results.splice(cursor[1])
      }
    }
  }

  /**
   * Returns the current context, including results of executed actions.
   */
  getContext(): ContextValueMap {
    const context: ContextValueMap = { ...this.initialContext }
    for (const [phaseIdx, results] of this.resultMap) {
      if (phaseIdx <= this.cursor[0]) {
        for (const res of results) {
          Object.assign(context, { [res.contextKey]: res.output })
        }
      }
    }
    return context
  }

  /**
   * Returns the number of actions in a specific phase.
   */
  getPhaseSize(index: number = this.cursor[0]): number {
    return this.phaseSizeMap.get(index)!
  }

  /**
   * Returns the action results for a specific phase.
   */
  getPhaseResults(index: number = this.cursor[0]): ActionResultLog[] {
    return this.resultMap.get(index)!
  }

  /**
   * Adds a new action result to the current phase and the result log.
   */
  pushResult({ ...result }: ActionResultLog) {
    const results = this.getPhaseResults()
    results.push(result)
    this.resultLog.push(result)
  }

  private set cursor(val: ExecutionCursor) {
    this.#cursor = [...val]
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

/**
 * Represents the current position in the workflow as [phaseIndex, actionIndex].
 */
export type ExecutionCursor = [number, number]
