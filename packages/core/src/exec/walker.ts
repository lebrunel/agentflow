import { ExecutionCursor } from './cursor'
import type { WorkflowScope, WorkflowPhase, WorkflowStep } from '../ast'
import type { Workflow } from '../workflow'

export class ExecutionWalker {
  readonly assert: Strict<ExecutionWalker>

  constructor(readonly workflow: Workflow) {
    this.assert = createStrictProxy(this)
  }

  findScope(cursor: ExecutionCursor): WorkflowScope | undefined {
    let scope: WorkflowScope | undefined = this.workflow.view

    for (const [_i, phaseIndex, stepIndex] of cursor.scope) {
      const phase: WorkflowPhase | undefined = scope?.phases[phaseIndex]
      const step: WorkflowStep | undefined = phase?.steps[stepIndex]
      scope = step?.childScope
    }

    return scope
  }

  findPhase(cursor: ExecutionCursor): WorkflowPhase | undefined {
    const scope = this.findScope(cursor)
    return scope?.phases[cursor.phaseIndex]
  }

  findStep(cursor: ExecutionCursor): WorkflowStep | undefined {
    const phase = this.findPhase(cursor)
    return phase?.steps[cursor.stepIndex]
  }

  nextCursor(cursor: ExecutionCursor): ExecutionCursor {
    const scope = this.assert.findScope(cursor)

    if (cursor.stepIndex < scope.phases[cursor.phaseIndex].steps.length - 1) {
      return ExecutionCursor.move(cursor, [
        cursor.iteration,
        cursor.phaseIndex,
        cursor.stepIndex + 1,
      ])
    } else if (cursor.phaseIndex < scope.phases.length - 1) {
      return ExecutionCursor.move(cursor, [
        cursor.iteration,
        cursor.phaseIndex + 1,
        0,
      ])
    } else if (scope.parentNode?.name === 'loop') {
      return ExecutionCursor.move(cursor, [
        cursor.iteration + 1,
        0,
        0,
      ])
    } else {
      return cursor
    }
  }
}

function createStrictProxy(walker: ExecutionWalker): Strict<ExecutionWalker> {
  return new Proxy(walker, {
    get(
      target: ExecutionWalker,
      prop: keyof ExecutionWalker,
      proxy: typeof Proxy<ExecutionWalker>,
    ) {
      if (prop.startsWith('find')) {
        return function(cursor: ExecutionCursor) {
          const result = (target as any)[prop].call(target, cursor)
          if (result === undefined) {
            throw new Error(`${prop.replace('find', '')} not found: ${cursor.toString()}`)
          }
          return result
        }
      } else {
        return Reflect.get(target, prop, proxy)
      }
    }
  }) as Strict<ExecutionWalker>
}

type Strict<T> = {
  [K in keyof T]: T[K] extends (cursor: ExecutionCursor) => (infer R) | undefined
    ? (cursor: ExecutionCursor) => R
    : T[K]
}
