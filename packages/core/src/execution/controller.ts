import { createNanoEvents, type Unsubscribe } from 'nanoevents'
import { ExecutionState, ExecutionStatus, type ExecutionCursor } from './state'
import { stringifyWithContext } from '../processor'

import type { Action, ActionResult } from '../action'
import type { ContextValueMap } from '../context'
import type { Phase } from '../phase'
import type { Workflow } from '../workflow'

export class ExecutionController {
  #events = createNanoEvents<ExecutionEvents>()
  readonly workflow: Workflow;
  private state: ExecutionState;
  private isRunAll = false 
  private prevPhase?: Phase

  constructor(workflow: Workflow, input: ContextValueMap) {
    this.workflow = workflow
    this.state = new ExecutionState(workflow, input)
  }

  get cursor(): ExecutionCursor {
    return this.state.cursor
  }

  get currentPhase(): Phase {
    return this.workflow.phases[this.state.cursor[0]]
  }

  get currentAction(): Action {
    return this.currentPhase.actions[this.state.cursor[1]]
  }

  get position(): string {
    return `${this.state.cursor[0]}.${this.currentAction.name}`
  }

  get status(): ExecutionStatus {
    return this.state.status
  }

  async runAll(afterEachAction?: AfterActionCallback): Promise<void> {
    this.isRunAll = true
    this.status = ExecutionStatus.Running

    while (this.state.status === ExecutionStatus.Running) {
      try {
        await this.runNext(afterEachAction)
      } catch(error) {
        this.status = ExecutionStatus.Error
        this.#events.emit('error', error as Error, this.cursor)
        break
      }
    }

    this.isRunAll = false
  }

  async runNext(afterAction?: AfterActionCallback): Promise<ExecutionCursor> {
    if (
      this.status === ExecutionStatus.Completed ||
      this.status === ExecutionStatus.Error
    ) {
      throw new Error('Workflow has ended. Use `reset()` or `rewindTo()`.')
    }

    this.status = ExecutionStatus.Running

    const cursor = this.cursor
    const phase = this.currentPhase
    const action = this.currentAction

    if (phase !== this.prevPhase) {
      this.#events.emit('phase', phase, this.prevPhase, this.cursor)
    }

    this.#events.emit('action.start', action, this.cursor)

    const result = await action.execute(
      this.state.getContext(),
      this.state.getPhaseResults(),
    )

    this.state.pushResult(result)
    this.#events.emit('action.complete', {...result}, this.cursor)

    if (this.state.isLastAction) {
      this.status = ExecutionStatus.Completed
      this.#events.emit('complete', this.getCompleteOutput(), this.cursor)
    } else {
      this.prevPhase = phase
      this.state.advanceCursor()
      if (!this.isRunAll) {
        this.status = ExecutionStatus.Paused
      }
    }

    if (typeof afterAction === 'function') {
      await afterAction(result, cursor)
    }

    return cursor
  }

  pause(): void {
    if (this.status === ExecutionStatus.Running) {
      this.status = ExecutionStatus.Paused
    }
  }

  rewindTo(cursor: ExecutionCursor): void
  rewindTo(position: string): void
  rewindTo(target: ExecutionCursor | string): void {
    if (this.state.status === ExecutionStatus.Running) {
      throw new Error("Cannot reset while running. Pause first.");
    }

    // get cursor from argument
    if (Array.isArray(target) && target.length == 2 && target.every(n => typeof n === 'number')) {
      this.state.rewindCursor(target)
    } else if (typeof target === 'string') {
      const [phaseNum, actionName] = target.split('.')
      const phaseIdx = Number(phaseNum) - 1
      const phase = this.workflow.phases[phaseIdx]
      const actionIdx = phase?.actions.findIndex(a => a.name === actionName)

      if (!phase || actionIdx === -1) {
        throw new Error(`Invalid position: ${target}`)
      }

      this.state.rewindCursor([phaseIdx, actionIdx])
    } else {
      throw new Error(`Invalid argument for rewindTo: ${JSON.stringify(target)}`)
    }

    if (this.state.isFirstAction) {
      this.status = ExecutionStatus.Ready
    } else {
      this.status = ExecutionStatus.Paused
    }
    
    this.#events.emit('rewind', this.cursor)
  }

  reset(): void {
    this.rewindTo([0, 0])
  }

  getCurrentContext(): Readonly<ContextValueMap> {
    // todo - clone results for better saftey
    return Object.freeze({...this.state.getContext()})
  }

  getCurrentResults(): ReadonlyMap<Phase, ActionResult[]> {
    const resultMap = new Map<Phase, ActionResult[]>() 
    for (const [phaseIdx, results] of this.state.resultMap) {
      // todo - clone results for better saftey
      resultMap.set(this.workflow.phases[phaseIdx], [...results])
    }
    return resultMap
  }

  getPhaseResults(phase: Phase): ActionResult[] {
    const phaseIdx = this.getPhaseIndex(phase)
    const results = this.state.getPhaseResults(phaseIdx)
    // todo - clone results for better saftey
    return [...results]
  }

  getPhaseOutput(phase: Phase): string {
    const phaseIdx = this.getPhaseIndex(phase)
    const phaseResults = this.state.getPhaseResults(phaseIdx)
    const trailingNodes = phase.trailingNodes

    if (phaseResults.length < this.state.getPhaseSize(phaseIdx)) {
      throw new Error('Cannot create output for workflow phase. Not all actions complete.')
    }

    let resultChunks: string[] = []
    for (const result of phaseResults) {
      // todo - better stringifying of ContextValue types
      if (result.input.type === 'text') {
        resultChunks.push(result.input.text)
      }
      if (result.output.type === 'text') {
        resultChunks.push(result.output.text)
      }
    }

    if (trailingNodes.length) {
      const trailingText = stringifyWithContext(trailingNodes, this.state.getContext())
      resultChunks.push(trailingText)
    }

    return resultChunks.join('\n\n')
  }

  getCompleteOutput(): string {
    if (this.state.status !== ExecutionStatus.Completed) {
      throw new Error(`Cannot get results whilst status is ${ExecutionStatus[this.status]}.`)
    }

    return this.workflow.phases
      .map(phase => this.getPhaseOutput(phase))
      .join('\n\n---\n\n')
  }

  on<E extends keyof ExecutionEvents>(
    event: E,
    handler: ExecutionEvents[E],
  ): Unsubscribe {
    return this.#events.on(event, handler)
  }

  private set status(val: ExecutionStatus) {
    if (this.state.status !== val) {
      this.state.status = val
      this.#events.emit('status', val, this.cursor)
    }
  }

  private getPhaseIndex(phase: Phase): number {
    const phaseIdx = this.workflow.phases.indexOf(phase)
    if (phaseIdx === -1) {
      throw new Error('Provided phase is not part of the current workflow.');
    }
    return phaseIdx
  }
}

// Types

export interface ExecutionEvents {
  /** Status has changed */ 
  'status': (status: ExecutionStatus, cursor: ExecutionCursor) => void;
  /** Action is starting */
  'action.start': (action: Action, cursor: ExecutionCursor) => void;
  /** Action has completed */
  'action.complete': (result: ActionResult, cursor: ExecutionCursor) => void;
  /** A new phase is starting */
  'phase': (phase: Phase, prev: Phase | undefined, cursor: ExecutionCursor) => void;
  /** The runner has completed  */
  'complete': (output: string, cursor: ExecutionCursor) => void;
  /** The runner has errors */
  'error': (error: Error, cursor: ExecutionCursor) => void;
  /** The cursor has been rewound */
  'rewind': (cursor: ExecutionCursor) => void;
}

export type AfterActionCallback = (result: ActionResult, cursor: ExecutionCursor) => void | Promise<void>