import type { ExecutionCursor } from './cursor'
import type { Workflow, WorkflowPhase, WorkflowAction } from '../workflow'

export class ExecutionNavigator {
  #cache: Map<string, any> = new Map()

  constructor(readonly workflow: Workflow) {}

  findAction(cursor: ExecutionCursor): WorkflowAction | undefined {
    return this.cached('action', cursor.toString(), () => {
      const phase = this.findPhase(cursor)
      return phase?.actions[cursor.actionIndex]
    })
  }

  fetchAction(cursor: ExecutionCursor): WorkflowAction {
    const action = this.findAction(cursor)
    if (!action) throw new Error(`Action not found: ${cursor.toString()}`)
    return action
  }

  findPhase(cursor: ExecutionCursor): WorkflowPhase | undefined {
    return this.cached('phase', cursor.toString(), () => {
      const phases = this.findScope(cursor)
      return phases && phases[cursor.phaseIndex]
    })
  }

  fetchPhase(cursor: ExecutionCursor): WorkflowPhase {
    const phase = this.findPhase(cursor)
    if (!phase) throw new Error(`Phase not found: ${cursor.toString()}`)
    return phase
  }

  findScope(cursor: ExecutionCursor): ReadonlyArray<WorkflowPhase> | undefined {
    return this.cached('scope', cursor.path, () => {
      let scope: ReadonlyArray<WorkflowPhase> = this.workflow.phases

      try {
        for (const [_i, phaseIndex, actionIndex] of cursor.scope) {
          const phase = scope[phaseIndex]
          const action = phase.actions[actionIndex]
          scope = action.phases
        }
      } catch(e) {
        return undefined
      }

      return scope
    })
  }

  fetchScope(cursor: ExecutionCursor): ReadonlyArray<WorkflowPhase> {
    const phases = this.findScope(cursor)
    if (!phases) throw new Error(`Scope not found: ${cursor.path}`)
    return phases
  }

  private cached<T>(prefix: string, key: string, callback: () => T | undefined): T | undefined {
    const cacheKey = `${prefix}:${key}`
    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey)
    }
    const item = callback()
    this.#cache.set(cacheKey, item)
    return item
  }
}
