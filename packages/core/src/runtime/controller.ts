import { createNanoEvents, type Unsubscribe } from 'nanoevents'
import { pushable } from 'it-pushable'
import { CostCalculator } from '../ai'
import { astToContext, stringifyContext } from '../context'
import { parseCursor, stringifyCursor } from './cursor'
import { evalExpressionSync } from './eval'
import { ExecutionState, ExecutionStatus } from './state'

import type { RootContent } from 'mdast'
import type { ExecutionCursor, Position } from './cursor'
import type { Runtime } from './runtime'
import type { ActionContext, ActionEvent, ActionResultLog } from '../action'
import type { ModelSpec } from '../ai'
import type { ContextValueMap } from '../context'
import type { Workflow, WorkflowPhase, WorkflowAction } from '../workflow'
import type { ExpressionNode } from '../compiler'

/**
 * Manages the execution of a workflow, controlling its state and progression.
 */
export class ExecutionController {
  #events = createNanoEvents<ExecutionEvents>()
  // todo - should store errors on the controller so can access them without event handler
  //private state: ExecutionState;
  private state: ExecutionState
  private isRunAll = false
  private prevPhase?: WorkflowPhase

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
  get currentPhase(): WorkflowPhase {
    return this.findPhase(this.cursor)
  }

  get currentPhaseIndex(): number {
    return this.state.cursorTail[1]
  }

  /** The current action of the workflow being executed. */
  get currentAction(): WorkflowAction {
    const actionIndex = this.state.cursorTail[2]
    return this.currentPhase.actions[actionIndex]
  }

  /** A string representation of the current position in the workflow. */
  get position(): string {
    return stringifyCursor(this.cursor)
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
    const phaseIdx = this.currentPhaseIndex

    if (phase !== this.prevPhase) {
      this.#events.emit('phase', phase, this.prevPhase, cursor)
    }

    const action = this.getCurrentAction()
    const handler = this.runtime.useAction(action.name)
    const context = this.state.currentScope.getContext()
    const input = astToContext(action.contentNodes as RootContent[], context)
    const stream = pushable<string>({ objectMode: true })

    const actionCtx: ActionContext = {
      action,
      input,
      results: this.state.currentScope.getPhaseResults(phaseIdx),
      stream,
    }

    const actionResult = new Promise<ActionResultLog>(async resolve => {
      const { output, usage } = await handler.execute(actionCtx, this.runtime)
      resolve({
        cursor,
        name: action.name,
        contextKey: action.contextKey,
        input,
        output,
        usage,
      })
    })

    this.#events.emit('action', {
      action,
      stream,
      input: stringifyContext(input),
      result: actionResult
    }, cursor)

    const result = await actionResult
    stream.end()
    this.state.currentScope.pushPhaseResults(phaseIdx, result)

    if (this.state.isScopeEnd) {
      this.status = ExecutionStatus.Completed
      this.#events.emit('complete', this.getCompleteOutput(), cursor)
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
  rewindTo(position: Position): void
  rewindTo(cursor: ExecutionCursor | string): void {
    if (this.state.status === ExecutionStatus.Running) {
      throw new Error("Cannot reset while running. Pause first.");
    }

    if (typeof cursor === 'string') {
      cursor = parseCursor(cursor)
    }

    this.state.rewindCursor(cursor)

    if (cursor.length === 1 && this.state.isScopeStart) {
      this.status = ExecutionStatus.Ready
    } else {
      this.status = ExecutionStatus.Paused
    }

    this.#events.emit('rewind', cursor)
  }

  /**
   * Resets the workflow to its initial state.
   */
  reset(): void {
    this.rewindTo([[0, 0, 0]])
  }

  /**
   * TODO
   */
  findPhase(cursor: ExecutionCursor): WorkflowPhase {
    let phases = this.workflow.phases
    let phase: WorkflowPhase | undefined

    for (let i = 0; i < cursor.length; i++) {
      const [_i, phaseIdx, actionIdx] = cursor[i]

      phase = phases[phaseIdx]

      if (i === cursor.length - 1) {
        return phase
      } else {
        const action = phase.actions[actionIdx]
        phases = action.phases
        continue
      }
    }

    throw new Error(`Cursor does not point to a phase: ${cursor}`)
  }

  /**
   * TODO
   */
  getCurrentAction(): WorkflowAction {
    const { name, contextKey, contentNodes, phases } = this.currentAction
    const handler = this.runtime.useAction(name)
    const context = this.getCurrentContext()
    const props: any = {}

    for (const [key, val] of Object.entries(this.currentAction.props)) {
      props[key] = isExpression(val)
        ? evalExpressionSync(val.data!.estree!, context)
        : val
    }

    return {
      name,
      contextKey,
      contentNodes,
      props: handler.parse(props),
      phases,
    }
  }

  /**
   * Returns the current context of the workflow execution.
   */
  getCurrentContext(): Readonly<ContextValueMap> {
    const context = this.state.currentScope.getContext()
    // todo - clone results for better saftey
    return Object.freeze({...context})
  }

  /**
   * Returns a map of all action results grouped by phase.
   */
  getCurrentResults(): ReadonlyMap<WorkflowPhase, ActionResultLog[]> {
    const resultMap = new Map<WorkflowPhase, ActionResultLog[]>()
    for (const [phaseIdx, results] of this.state.currentScope.resultMap) {
      // todo - clone results for better saftey
      resultMap.set(this.workflow.phases[phaseIdx], [...results])
    }
    return resultMap
  }

  /**
   * Returns the action results for a specific phase.
   */
  getPhaseResults(phase: WorkflowPhase): ActionResultLog[] {
    const phaseIdx = this.getPhaseIndex(phase)
    const results = this.state.currentScope.getPhaseResults(phaseIdx)
    // todo - clone results for better saftey
    return [...results]
  }

  /**
   * Generates the output for a specific phase of the workflow.
   */
  getPhaseOutput(phase: WorkflowPhase): string {
    const phaseIdx = this.getPhaseIndex(phase)
    const phaseResults = this.state.currentScope.getPhaseResults(phaseIdx)
    const trailingNodes = phase.trailingNodes

    if (phaseResults.length < this.state.currentScope.getPhaseSize(phaseIdx)) {
      throw new Error('Cannot create output for workflow phase. Not all actions complete.')
    }

    let resultChunks: string[] = []
    for (const result of phaseResults) {
      resultChunks.push(stringifyContext(result.input))
      resultChunks.push(stringifyContext(result.output))
    }

    if (trailingNodes.length) {
      resultChunks.push(
        stringifyContext(
          astToContext(trailingNodes as RootContent[], this.state.currentScope.getContext())
        )
      )
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
   * TODO
   */
  getCostEstimate(models?: Record<string, ModelSpec>): CostCalculator {
    const calculator = new CostCalculator(models)

    for (const [_key, scope] of this.state.scopes) {
      for (const res of scope.resultLog) {
        if (typeof res.usage === 'undefined') continue

        const phase = this.findPhase(res.cursor)
        const action = phase.actions[res.cursor[res.cursor.length - 1][2]]
        const model = action.props?.model

        if (typeof model === 'string') {
          calculator.addUsage(model, res.usage)
        }
      }
    }

    return calculator
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

  private getPhaseIndex(phase: WorkflowPhase): number {
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
  { start = true, afterAction }: ExecutionOptions = {},
) {
  const controller = new ExecutionController(workflow, input, runtime)
  if (start) { queueMicrotask(() => controller.runAll(afterAction) )}
  return controller
}

function isExpression(val: any): val is ExpressionNode {
  return typeof val === 'object' && val.type === 'expression' && !!val.data
}

/**
 * Events emitted during workflow execution.
 */
export interface ExecutionEvents {
  /** Status has changed */
  'status': (status: ExecutionStatus, cursor: ExecutionCursor) => void;

  /** Action is starting */
  'action': (event: ActionEvent, cursor: ExecutionCursor) => void;

  /** A new phase is starting */
  'phase': (phase: WorkflowPhase, prev: WorkflowPhase | undefined, cursor: ExecutionCursor) => void;

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
export interface ExecutionOptions {
  start?: boolean;
  afterAction?: AfterActionCallback;
}

/**
 * Callback function executed after each action in the workflow.
 */
export type AfterActionCallback =
  (result: ActionResultLog, cursor: ExecutionCursor) => void | Promise<void>
