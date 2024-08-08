import { default as dd } from 'ts-dedent'
import type { Workflow } from './workflow'
import type { ContextMap } from './context'

export class ExecutionState {
  #indexMap: Map<number, string[]> = new Map();
  #cursor: ExecutionCursor = [0, 0]
  contextHistory: Map<ExecutionCursor, ContextMap> = new Map()
  actionResults: Map<ExecutionCursor, ActionResult> = new Map()

  constructor(workflow: Workflow, initialContext: ContextMap) {
    for (let i = 0; i < workflow.phases.length; i++) {
      // todo, get action names
      const actions: string[] = []
      this.#indexMap.set(i, actions)
    }
    this.contextHistory.set(this.cursor, initialContext)
  }

  get isFinished(): boolean {
    const phaseActions = this.#indexMap.get(this.cursor[0]) || []
    return this.cursor[0] === this.#indexMap.size - 1 &&
           this.cursor[1] === phaseActions.length -1
  }

  get cursor(): ExecutionCursor {
    return this.#cursor
  }

  get context(): ContextMap {
    return this.contextHistory.get(this.cursor)!
  }

  get position(): string {
    const [phaseIdx, actionIdx] = this.cursor
    const actionNames = this.#indexMap.get(phaseIdx)!
    return `${phaseIdx + 1}.${actionNames[actionIdx]}`
  }

  setActionResult(result: ActionResult) {
    this.actionResults.set(this.cursor, result)
  }

  next() {
    const phaseActions = this.#indexMap.get(this.cursor[0])!
    if (this.cursor[1] < phaseActions.length - 1) {
      // next action
      this.advanceCursor([this.cursor[0], this.cursor[1] + 1])
    } else if (this.cursor[0] < this.#indexMap.size - 1) {
      // next phase
      this.advanceCursor([this.cursor[0] + 1, 0])
    }
  }

  rewind(position: string) {
    if (!/^\d+\.\w+$/.test(position)) {
      throw new Error(dd`
      Invalid position format. Please use 'phase.action' (eg. '2.summary').
      `)
    }

    const [phaseNum, actionName] = position.split('.')
    const phaseIdx = Number(phaseNum) - 1
    const actionNames = this.#indexMap.get(phaseIdx) || []
    const actionIdx = actionNames.indexOf(actionName)
    const nextCursor: ExecutionCursor = [phaseIdx, actionIdx]

    if (actionIdx === -1) {
      throw new Error(dd`
      Invalid position. '#{position}' not found.
      `)
    }

    if (!cursorLessThan(nextCursor, this.cursor)) {
      throw new Error(dd`
      Invalid position. '#{position}' does not rewind the execution.
      `)
    }

    this.#cursor = nextCursor 
  }

  private advanceCursor(cursor: ExecutionCursor) {
    // todo - get correct result!!
    const result = this.actionResults.get(this.cursor)!
    const newContext = { ...this.context, ...result}
    this.#cursor = cursor
    this.contextHistory.set(this.cursor, newContext)
  }

}

type ExecutionCursor = [number, number]

export enum ExecutionStatus {
  Error = -1,
  Paused,
  Running,
  Success,
}

// Helpers

// Checks cursor A is less than cursor B
function cursorLessThan(a: ExecutionCursor, b: ExecutionCursor): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
}