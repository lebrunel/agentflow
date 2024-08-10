import type { ContextValueMap } from '../context'
import type { Workflow } from '../workflow'
import type { ActionResult } from '../action'

export class ExecutionState {
  cursor: ExecutionCursor = [0, 0]
  context: ContextValueMap
  actionIndex: Map<number, string[]> = new Map()
  results: Map<number, ActionResult[]> = new Map()
  // todo - add push only log that can't be rewound

  constructor(workflow: Workflow, context: ContextValueMap) {
    // iterate over phases to create action index
    for (let i = 0; i < workflow.phases.length; i++) {
      const phase = workflow.phases[i]
      const actions: string[] = phase.actions.map(a => a.name)
      this.actionIndex.set(i, actions)
      this.results.set(i, [])
    }
    this.context = context
  }

  get isDone(): boolean {
    return this.cursor[0] >= this.actionIndex.size - 1 &&
           this.cursor[1] >= this.getPhaseActions().length -1 &&
           this.results.get(this.cursor[0])!.length >= this.getPhaseActions().length
  }

  get position(): string {
    const [phaseIdx, actionIdx] = this.cursor
    const actionNames = this.actionIndex.get(phaseIdx)!
    return `${phaseIdx + 1}.${actionNames[actionIdx]}`
  }

  getPhaseActions(index: number = this.cursor[0]): string[] {
    return this.actionIndex.get(index)!
  }

  getPhaseResults(index: number = this.cursor[0]): ActionResult[] {
    return this.results.get(index)!
  }

  getContext(): ContextValueMap {
    const resultMap = this.getPhaseResults().reduce((map, res) => {
      map[res.name] = res.output
      return map
    }, {} as ContextValueMap)
    return { ...this.context, ...resultMap }
  }

  pushResult(result: ActionResult) {
    this.getPhaseResults().push(result)
  }

  next() {
    if (this.isDone) {
      console.error('Execution is finished.')
    }

    if (this.cursor[1] < this.getPhaseActions().length - 1) {
      this.cursor = [this.cursor[0], this.cursor[1] + 1]
    } else if (this.cursor[0] < this.actionIndex.size - 1) {
      this.cursor = [this.cursor[0] + 1, 0]
    }
  }

  rewind(position: string) {
    const [phaseNum, actionName] = position.split('.')
    const phaseIdx = Number(phaseNum) - 1
    const actionNames = this.actionIndex.get(phaseIdx) || []
    const actionIdx = actionNames.indexOf(actionName)
    const nextCursor: ExecutionCursor = [phaseIdx, actionIdx]

    if (actionIdx === -1) {
      throw new Error(`Invalid position. '${position}' not found.`)
    }

    if (!cursorLessThan(nextCursor, this.cursor)) {
      throw new Error(`Invalid position. '${position}' does not rewind the execution.`)
    }

    // todo - delete results

    this.cursor = nextCursor 
  }
}

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

// Types

type ExecutionCursor = [number, number]
