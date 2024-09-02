import type { ActionResultLog } from '../action'
import type { ContextValueMap } from '../context'
import type { WorkflowPhase } from '../workflow'

/**
 * Maintains the state within a single scope of a workflow execution.
 */
export class ExecutionScope {
  initialContext: ContextValueMap
  phaseSizeMap: Map<number, number> = new Map()
  resultMap: Map<number, ActionResultLog[]> = new Map()
  resultLog: ActionResultLog[] = []

  constructor(
    phases: readonly WorkflowPhase[],
    context: ContextValueMap,
  ) {
    // iterate over phases to populate size map and result map
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i]
      this.phaseSizeMap.set(i, phase.actions.length)
      this.resultMap.set(i, [])
    }
    this.initialContext = {...context}
  }

  /** The total number of phases in the workflow. */
  get phaseCount(): number {
    return this.phaseSizeMap.size
  }

  /**
   * Returns the current context, including results of executed actions.
   */
  getContext(): ContextValueMap {
    const context: ContextValueMap = { ...this.initialContext }
    for (const [_phaseIdx, results] of this.resultMap) {
      for (const res of results) {
        Object.assign(context, { [res.contextKey]: res.output })
      }
    }
    return context
  }

  /**
   * Returns the number of actions in a specific phase.
   */
  getPhaseSize(index: number): number {
    return this.phaseSizeMap.get(index)!
  }

  /**
   * Returns the action results for a specific phase.
   */
  getPhaseResults(index: number): ActionResultLog[] {
    return this.resultMap.get(index)!
  }

  /**
   * Adds a new action result to the current phase and the result log.
   */
  pushPhaseResults(index: number, { ...result }: ActionResultLog) {
    const results = this.getPhaseResults(index)
    results.push(result)
    this.resultLog.push(result)
  }
}
