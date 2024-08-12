import type { CompletionUsage } from 'ai'
import type { ContextValueMap } from '../context'
import type { Workflow } from '../workflow'
import type { ActionResult } from '../action'

export class ExecutionState {
  #cursor: ExecutionCursor = [0, 0]
  status: ExecutionStatus = ExecutionStatus.Ready
  
  initialContext: ContextValueMap
  phaseSizeMap: Map<number, number> = new Map()
  resultMap: Map<number, ActionResult[]> = new Map()
  resultLog: ActionResult[] = []

  constructor(workflow: Workflow, context: ContextValueMap) {
    // iterate over phases to populate size map and result map
    for (let i = 0; i < workflow.phases.length; i++) {
      const phase = workflow.phases[i]
      this.phaseSizeMap.set(i, phase.actions.length)
      this.resultMap.set(i, [])
    }
    this.initialContext = context
  }

  get cursor(): ExecutionCursor {
    return [...this.#cursor]
  }

  get phaseCount(): number {
    return this.phaseSizeMap.size
  }

  get isFirstAction(): boolean {
    return this.cursor.every(n => n === 0)
  }

  get isLastAction(): boolean {
    return this.cursor[0] === this.phaseCount - 1 &&
           this.cursor[1] === this.getPhaseSize() - 1
  }

  advanceCursor(): void {
    if (this.cursor[1] < this.getPhaseSize() - 1) {
      this.cursor = [this.cursor[0], this.cursor[1] + 1]
    } else if (this.cursor[0] < this.phaseSizeMap.size - 1) {
      this.cursor = [this.cursor[0] + 1, 0]
    }
  }

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

  getContext(): ContextValueMap {
    const context: ContextValueMap = { ...this.initialContext }
    for (const [phaseIdx, results] of this.resultMap) {
      if (phaseIdx <= this.cursor[0]) {
        for (const res of results) {
          Object.assign(context, { [res.name]: res.output })
        }
      }
    }
    return context
  }

  getPhaseSize(index: number = this.cursor[0]): number {
    return this.phaseSizeMap.get(index)!
  }

  getPhaseResults(index: number = this.cursor[0]): ActionResult[] {
    return this.resultMap.get(index)!
  }

  pushResult(result: ActionResult) {
    const results = this.getPhaseResults()
    results.push(result)
    this.resultLog.push(result)
  }

  private set cursor(val: ExecutionCursor) {
    this.#cursor = [...val]
  }
}

export enum ExecutionStatus {
  Ready,      // Initial state, cursor at [0,0]
  Running,    // Workflow is in progress
  Paused,     // Execution paused, waiting for next action
  Completed,  // All actions executed successfully
  Error,      // An error occurred during execution
}

// Types

export type ExecutionCursor = [number, number]
