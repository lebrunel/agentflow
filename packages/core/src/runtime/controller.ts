import { createNanoEvents, type Unsubscribe } from 'nanoevents'
import { pushable } from 'it-pushable'
import { ExecutionCursor } from './cursor'
import { evalExpression } from './eval'
import { ExecutionNavigator } from './navigator'
import { ExecutionState } from './state'
import { CostCalculator } from '../ai'
import { astToContext, stringifyContext, unwrapContext, wrapContext } from '../context'

import type { RootContent } from 'mdast'
import type { Pushable } from 'it-pushable'
import type { Runtime } from './runtime'
import type { ModelSpec } from '../ai'
import type { ActionResult, ActionLog } from '../action'
import type { ExpressionNode } from '../compiler'
import type { ContextValueMap, JsonContextValue } from '../context'
import type { Workflow, WorkflowPhase, WorkflowAction } from '../workflow'

export class ExecutionController {
  #events = createNanoEvents<ExecutionEvents>()
  #cursor = new ExecutionCursor()
  #cursorSet = new Set<ExecutionCursor>()
  #cursorStack: ExecutionCursor[] = []
  #status: ExecutionStatus = ExecutionStatus.Ready
  #workflow: ExecutionNavigator

  readonly runtime: Runtime
  readonly state = new ExecutionState()

  constructor(workflow: Workflow, input: ContextValueMap, runtime: Runtime) {
    this.#workflow = new ExecutionNavigator(workflow)
    this.runtime = runtime
    this.state.pushContext(this.cursor, input)
  }

  get cursor(): ExecutionCursor {
    return this.#cursor
  }

  get status(): ExecutionStatus {
    return this.#status
  }

  get workflow(): Workflow {
    return this.#workflow.workflow
  }

  get currentPhase(): WorkflowPhase {
    return this.#workflow.fetchPhase(this.cursor)
  }

  get currentAction(): WorkflowAction {
    return this.#workflow.fetchAction(this.cursor)
  }

  get currentContext(): ContextValueMap {
    return this.state.getContext(new ExecutionCursor())
  }

  private set status(status: ExecutionStatus) {
    if (this.status !== status) {
      this.#status = status
      this.#events.emit('status', status, this.cursor)
    }
  }

  /**
   * Executes the entire workflow from the current position to completion.
   * The optional callback is called synchronously after each action, allowing
   * inspection of results and pausing of the workflow if necessary.
   */
  async runAll(afterEachAction?: AfterActionCallback): Promise<void> {
    this.status = ExecutionStatus.Running

    while (this.status === ExecutionStatus.Running) {
      try {
        await this.runNext({ afterAction: afterEachAction, runAll: true })
      } catch (error) {
        this.status = ExecutionStatus.Error
        this.#events.emit('error', error as Error, this.cursor)
        break
      }
    }
  }

  /**
   * Executes the next action in the workflow. The optional callback is called
   * synchronously after the action completes, allowing inspection of the result
   * and pausing of the workflow if necessary.
   */
  async runNext({
    afterAction,
    runAll = false
  }: {
    afterAction?: AfterActionCallback,
    runAll?: boolean,
  } = {}): Promise<ExecutionCursor> {
    if (
      this.status === ExecutionStatus.Completed ||
      this.status === ExecutionStatus.Error
    ) {
      throw new Error('Workflow has ended. Use `reset()` or `rewindTo()`.')
    }

    this.status = ExecutionStatus.Running

    const cursor = this.cursor
    this.#cursorStack.push(cursor)

    if (cursor.actionIndex === 0 && !this.#cursorSet.has(cursor)) {
      const phase = this.#workflow.fetchPhase(cursor)
      this.#events.emit('phase', phase, cursor)
      this.#cursorSet.add(cursor)
    }

    const phases = this.#workflow.fetchScope(cursor)
    const action = this.#workflow.fetchAction(cursor)
    const context = this.state.getContext(cursor)
    const computed = this.state.getComputed(cursor)
    const input = astToContext(action.contentNodes as RootContent[], context, computed)
    const stream = pushable<string>({ objectMode: true })

    const actionResult: Promise<ActionResult> = (async () => {
      switch (action.name) {
        //case 'if':
        //  // todo handle If
        //  break
        case 'loop':
          let loopIndex: number = this.cursor.iteration

          // Computed props
          const $index = () => loopIndex
          const $self = () => {
            return this.state.getScopeResults(this.cursor).reduce((acc, actionLog) => {
              const c = ExecutionCursor.parse(actionLog.cursor)
              const i = c.iteration
                ; (acc[i] ||= {})[actionLog.contextKey] = actionLog.output.value
              return acc
            }, [] as Array<Record<string, any>>)
          }
          const $last = () => {
            const self = $self()
            return self[self.length - 1]
          }

          this.#cursor = ExecutionCursor.push(cursor)
          const newContext = action.props.provide
            ? evalExpression(
              action.props.provide.value,
              unwrapContext(context),
              computed
            ) : {}

          this.state.pushContext(
            this.#cursor,
            wrapContext(newContext),
            { $self, $index, $last },
          )

          while (true) {
            const isDone = evalExpression(
              action.props.until.value,
              unwrapContext(context),
              { $index, $self, $last },
            )

            if (isDone) { break }
            await this.runNext({ afterAction, runAll })
            loopIndex = this.cursor.iteration
          }

          const { results } = this.state.getExecutionScope(this.#cursor)
          const value = [...results.values()].map(actionLog => {
            const output = actionLog.output
            // special case for files, we want this to be jsonish
            // todo - unure if this is right tbh... but will do for now
            if (output.type === 'file') {
              const file = output.value
              return { [actionLog.contextKey]: { type: 'file', name: file.name, contentType: file.type} }
            }
            //if (output.type === 'primitive' && typeof output.value === 'symbol') {
            //  return { [actionLog.contextKey]: { type: 'symbol', description: output.value.description } }
            //}
            return { [actionLog.contextKey]: actionLog.output.value }
          })
          this.#cursor = ExecutionCursor.pop(this.cursor)
          return { result: { type: 'json', value } as JsonContextValue }

        default:
          // handle arbitrary action
          // 1. evaluate and validate props
          // 2. resolve with execute
          const handler = this.runtime.useAction(action.name)
          const evalProps = Object.entries(action.props).reduce((props, [key, val]) => {
            props[key] = isExpression(val)
              ? evalExpression(val.value, context, computed)
              : val
            return props
          }, {} as any)
          const props = handler.parse(evalProps)
          const prevResults = this.state.getPhaseResults(cursor)
          return handler.execute({ props, input, results: prevResults, runtime: this.runtime, stream })
      }
    })()

    this.#events.emit('action', {
      action,
      input: stringifyContext(input),
      output: actionResult.then(l => stringifyContext(l.result)),
      stream,
    }, cursor)

    const { result, meta } = await actionResult.then(res => {
      this.#cursorStack.pop()
      stream.end()
      return res
    })

    const actionLog: ActionLog = {
      cursor: cursor.toString(),
      actionName: action.name,
      contextKey: action.contextKey,
      input,
      output: result,
      meta: meta || {}
    }

    this.state.pushResult(cursor, actionLog)

    // Is it the final phase/action
    if (
      cursor.path === '/' &&
      cursor.phaseIndex === phases.length - 1 &&
      cursor.actionIndex === phases[phases.length - 1].actions.length - 1
    ) {
      this.status = ExecutionStatus.Completed
      this.#events.emit('complete', this.getFinalOutput(), cursor)
    } else {
      //this.prevPhase = phase // todo - mechanism for notifying new phase
      this.advanceCursor()
      if (!runAll) {
        this.status = ExecutionStatus.Paused
      }
    }

    if (typeof afterAction === 'function') {
      await afterAction(actionLog, cursor)
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
   * todo - needs to accept easier formats
   */
  rewindTo(cursor: string | ExecutionCursor): void {
    if (typeof cursor === 'string') {
      cursor = ExecutionCursor.parse(cursor)
    }
    if (this.status === ExecutionStatus.Running) {
      throw new Error('Cannot reset while running. Pause first.')
    }

    this.rewindCursor(cursor)

    if (this.cursor.path === '/' && this.cursor.location === '0.0.0') {
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
    this.rewindTo(new ExecutionCursor())
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

  /**
   * TODO
   */
  getCostEstimate(models?: Record<string, ModelSpec>): CostCalculator {
    const calculator = new CostCalculator(models)

    for (const scope of this.state.stateMap.values()) {
      for (const actionLog of scope.results.values()) {
        if (typeof actionLog.meta.usage === 'undefined') continue

        const cursor = ExecutionCursor.parse(actionLog.cursor)
        const action = this.#workflow.findAction(cursor)
        const model = action?.props?.model

        if (typeof model === 'string') {
          calculator.addUsage(model, actionLog.meta.usage)
        }
      }
    }

    return calculator
  }

  /**
   * Generates the final output for the entire workflow.
   */
  getFinalOutput(): string {
    if (this.status !== ExecutionStatus.Completed) {
      throw new Error(`Cannot get results whilst status is ${ExecutionStatus[this.status]}.`)
    }

    const stringifyScope = (cursor: ExecutionCursor): string => {
      const results = this.state.getGroupedScopeResults(cursor)

      return results
        .map(group => {
          const cursorForPhase = ExecutionCursor.parse(group[0].cursor)
          const phase = this.#workflow.fetchPhase(cursorForPhase)
          const context = this.state.getContext(cursorForPhase)
          const computed = this.state.getComputed(cursorForPhase)
          const chunks: string[] = []

          for (const actionLog of group) {
            const cursorForAction = ExecutionCursor.parse(actionLog.cursor)
            const inputStr = stringifyContext(actionLog.input)
            if (inputStr.length) {
              chunks.push(inputStr)
            }
            if (this.state.stateMap.has(cursorForAction.toString())) {
              chunks.push(stringifyScope(ExecutionCursor.push(cursorForAction)))
            } else {
              chunks.push(stringifyContext(actionLog.output))
            }
          }

          if (phase.trailingNodes.length) {
            const trailingValue = astToContext(phase.trailingNodes as RootContent[], context, computed)
            chunks.push(stringifyContext(trailingValue))
          }

          return chunks.join('\n\n')
        })
        .join('\n\n---\n\n')
    }

    return stringifyScope(new ExecutionCursor())

  }

  // Moves the cursor to the next action or phase within the current scope.
  private advanceCursor(): void {
    const cursor = this.cursor
    const phases = this.#workflow.fetchScope(cursor)
    const stackLen = this.#cursorStack.length
    const stackedAction = stackLen &&
      this.#workflow.fetchAction(this.#cursorStack[stackLen - 1])

    if (cursor.actionIndex < phases[cursor.phaseIndex].actions.length - 1) {
      this.#cursor = ExecutionCursor.move(cursor, [
        cursor.iteration,
        cursor.phaseIndex,
        cursor.actionIndex + 1,
      ])
    } else if (cursor.phaseIndex < phases.length - 1) {
      this.#cursor = ExecutionCursor.move(cursor, [
        cursor.iteration,
        cursor.phaseIndex + 1,
        0,
      ])
    } else if (stackedAction && stackedAction.name === 'loop') {
      this.#cursor = ExecutionCursor.move(cursor, [
        cursor.iteration + 1,
        0,
        0,
      ])
    }
  }

  // Moves the cursor to a previous position and clears subsequent results.
  private rewindCursor(cursor: ExecutionCursor): void {
    if (!cursor.lt(this.cursor)) {
      throw new Error(`Invalid cursor for rewind: ${cursor.toString()}`)
    }

    this.#cursor = cursor
    this.state.dropResultsFrom(cursor)
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
  'phase': (phase: WorkflowPhase, cursor: ExecutionCursor) => void;

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
 * TODO
 */
export interface ActionEvent<T = any> {
  action: WorkflowAction<T>;
  input: string;
  output: PromiseLike<string>;
  stream: Pushable<string>;
}

/**
 * Callback function executed after each action in the workflow.
 */
export type AfterActionCallback =
  (result: ActionLog, cursor: ExecutionCursor) => void | Promise<void>
