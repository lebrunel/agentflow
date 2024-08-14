import { createNanoEvents, type Unsubscribe } from 'nanoevents'

import { ExecutionState, ExecutionStatus, type ExecutionCursor } from '~/runtime/state'
import { stringifyNodes } from '~/util'
import type { Action } from '~/compiler/action'
import type { Phase } from '~/compiler/phase'
import type { Workflow } from '~/compiler/workflow'
import type { ActionResult } from '~/runtime/action'
import type { ContextValueMap } from '~/runtime/context'
import type { Runtime } from '~/runtime/runtime'

/**
 * Manages the execution of a workflow, controlling its state and progression.
 */
export class ExecutionController {
  #events = createNanoEvents<ExecutionEvents>()
  private state: ExecutionState;
  private isRunAll = false 
  private prevPhase?: Phase

  constructor(
    readonly workflow: Workflow,
    input: ContextValueMap,
    private runtime: Runtime,
  ) {
    this.state = new ExecutionState(workflow, input)
  }

  /** The current position in the workflow, represented as [phaseIndex, actionIndex]. */
  get cursor(): ExecutionCursor {
    return this.state.cursor
  }

  /** The current phase of the workflow being executed. */
  get currentPhase(): Phase {
    return this.workflow.phases[this.state.cursor[0]]
  }

  /** The current action of the workflow being executed. */
  get currentAction(): Action {
    return this.currentPhase.actions[this.state.cursor[1]]
  }

  /** A string representation of the current position in the workflow. */
  get position(): string {
    return `${this.state.cursor[0]}.${this.currentAction.name}`
  }

  /** The current status of the workflow execution. */
  get status(): ExecutionStatus {
    return this.state.status
  }

  /**
   * Executes the entire workflow from the current position to completion. 
   * The optional callback is called synchronously after each action, allowing 
   * inspection of results and pausing of the workflow if necessary.
   */
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

  /**
   * Executes the next action in the workflow. The optional callback is called 
   * synchronously after the action completes, allowing inspection of the result 
   * and pausing of the workflow if necessary.
   */
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

    if (phase !== this.prevPhase) {
      this.#events.emit('phase', phase, this.prevPhase, this.cursor)
    }

    const action = this.currentAction
    const handler = this.runtime.useAction(action.type)
    const input = action.getInputValue(this.state.getContext())

    this.#events.emit('action.start', action, this.cursor)

    const output = await handler.execute(
      { props: action.props, runtime: this.runtime },
      input,
      this.state.getPhaseResults(),
    )

    const result: ActionResult = {
      type: action.type,
      name: action.name,
      input,
      output,
    }

    this.state.pushResult(result)
    this.#events.emit('action.complete', result, this.cursor)

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

  /**
   * Pauses the execution of the workflow if it's currently running.
   */
  pause(): void {
    if (this.status === ExecutionStatus.Running) {
      this.status = ExecutionStatus.Paused
    }
  }

  /**
   * Moves the execution cursor to a specified position in the workflow.
   * */
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

  /**
   * Resets the workflow to its initial state.
   */
  reset(): void {
    this.rewindTo([0, 0])
  }

  /**
   * Returns the current context of the workflow execution.
   */
  getCurrentContext(): Readonly<ContextValueMap> {
    // todo - clone results for better saftey
    return Object.freeze({...this.state.getContext()})
  }

  /**
   * Returns a map of all action results grouped by phase.
   */
  getCurrentResults(): ReadonlyMap<Phase, ActionResult[]> {
    const resultMap = new Map<Phase, ActionResult[]>() 
    for (const [phaseIdx, results] of this.state.resultMap) {
      // todo - clone results for better saftey
      resultMap.set(this.workflow.phases[phaseIdx], [...results])
    }
    return resultMap
  }

  /**
   * Returns the action results for a specific phase.
   */
  getPhaseResults(phase: Phase): ActionResult[] {
    const phaseIdx = this.getPhaseIndex(phase)
    const results = this.state.getPhaseResults(phaseIdx)
    // todo - clone results for better saftey
    return [...results]
  }

  /**
   * Generates the output for a specific phase of the workflow.
   */
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
      const trailingText = stringifyNodes(trailingNodes, this.state.getContext())
      resultChunks.push(trailingText)
    }

    return resultChunks.join('\n\n')
  }

  /**
   * Generates the complete output for the entire workflow.
   */
  getCompleteOutput(): string {
    if (this.state.status !== ExecutionStatus.Completed) {
      throw new Error(`Cannot get results whilst status is ${ExecutionStatus[this.status]}.`)
    }

    return this.workflow.phases
      .map(phase => this.getPhaseOutput(phase))
      .join('\n\n---\n\n')
  }

  /**
   * Subscribes to execution events.
   */
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

/**
 * TODO
 */
export function executeWorkflow(
  workflow: Workflow,
  input: ContextValueMap,
  runtime: Runtime,
  { start = true, afterAction }: ExecutionOpts = {},
) {
  const controller = new ExecutionController(workflow, input, runtime)
  if (start) { queueMicrotask(() => controller.runAll(afterAction) )}
  return controller
}

/**
 * Events emitted during workflow execution.
 */
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

/**
 * TODO
 */
export interface ExecutionOpts {
  start?: boolean;
  afterAction?: AfterActionCallback;
}

/**
 * Callback function executed after each action in the workflow.
 */
export type AfterActionCallback = 
  (result: ActionResult, cursor: ExecutionCursor) => void | Promise<void>