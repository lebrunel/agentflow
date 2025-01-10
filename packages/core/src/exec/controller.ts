import { createNanoEvents } from 'nanoevents'
import { pushable } from 'it-pushable'
import { ExecutionCursor } from './cursor'
import { createDynamicEvaluator } from './eval'
import { ExecutionState } from './state'
import { ExecutionWalker } from './walker'
import { contextify, stringifyContext } from '../ast'
import { unwrapContext, wrapContext } from '../context'

import type { Unsubscribe } from 'nanoevents'
import type { Pushable } from 'it-pushable'
import type { ActionMeta, ActionResult, StepResult } from './state'
import type { ActionHelpers } from '../action'
import type { ExpressionNode, WorkflowScope, WorkflowPhase, WorkflowStep } from '../ast'
import type { Context, ContextKey, ContextValue, ContextValueMap } from '../context'
import type { Environment } from '../env'
import type { Workflow } from '../workflow'

export class ExecutionController {
  #events = createNanoEvents<ExecutionEvents>()
  #cursor = new ExecutionCursor()
  #status: ExecutionStatus = ExecutionStatus.Ready
  #walker: ExecutionWalker

  readonly state = new ExecutionState()

  constructor(readonly workflow: Workflow, input: ContextValueMap = {}) {
    this.#walker = new ExecutionWalker(workflow)
    this.state.pushContext(this.cursor, {
      ...wrapContext(workflow.meta.data || {}),
      ...input,
    })
  }

  get env(): Environment {
    return this.workflow.env
  }

  get cursor(): ExecutionCursor {
    return this.#cursor
  }

  get status(): ExecutionStatus {
    return this.#status
  }

  get currentScope(): WorkflowScope {
    return this.#walker.assert.findScope(this.cursor)
  }

  get currentPhase(): WorkflowPhase {
    return this.#walker.assert.findPhase(this.cursor)
  }

  get currentStep(): WorkflowStep {
    return this.#walker.assert.findStep(this.cursor)
  }

  private set status(status: ExecutionStatus) {
    if (this.status !== status) {
      this.#status = status
      this.#events.emit('status', status, this.cursor)
    }
  }

  /**
   * Executes the entire workflow from the current position to completion.
   * The optional callback is called synchronously after each step, allowing
   * inspection of results and pausing of the workflow if necessary.
   */
  async runAll(afterEachStep?: AfterStepCallback): Promise<void> {
    this.status = ExecutionStatus.Running

    while (this.status === ExecutionStatus.Running) {
      try {
        await this.runNext({ afterStep: afterEachStep, runAll: true })
      } catch (error) {
        this.status = ExecutionStatus.Error
        this.#events.emit('error', error as Error, this.cursor)
        break
      }
    }
  }

  /**
   * Executes the next action in the workflow. The optional callback is called
   * synchronously after the step completes, allowing inspection of the result
   * and pausing of the workflow if necessary.
   */
  async runNext({
    afterStep,
    runAll = false
  }: {
    afterStep?: AfterStepCallback,
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

    const scope = this.#walker.assert.findScope(cursor)
    const phase = this.#walker.assert.findPhase(cursor)
    const step = this.#walker.assert.findStep(cursor)

    if (cursor.stepIndex === 0 && !this.state.visited(phase)) {
      this.#events.emit('phase', phase, cursor)
    }

    this.state.visit(scope, phase, step)

    const evalExpression = createDynamicEvaluator(this.env)
    const context = this.state.getContext(cursor)
    const content = contextify(step.content, {
      evaluate: (node) => evalExpression(node, context)
    })

    let actionPromise: Promise<ActionResult> | undefined
    let actionStream: Pushable<string> | undefined

    if (step.action) {
      const actionNode = step.action
      let actionMeta: ActionMeta | undefined
      actionStream = pushable<string>({ objectMode: true })
      actionPromise = new Promise(resolve => {
        queueMicrotask(async () => {
          const action = this.env.useAction(actionNode.name)
          const contextKey: ContextKey = actionNode.attributes.as
          let helpers: ActionHelpers | undefined

          // Build action execution context
          const ctx: ExecutionContext = {
            content,
            getCursor: () => {
              return this.cursor
            },
            getPhaseResults: () => {
              return this.state.getPhaseResults(this.cursor)
            },
            getScopedContext: () => {
              return this.state.getScopeResults(this.cursor).map(results => {
                const context: ContextValueMap = {}
                for (const { action } of results) {
                  if (action) context[action.contextKey] = action.result
                }
                return unwrapContext(context)
              })
            },
            pushContext: (context) => {
              this.state.pushContext(
                this.cursor,
                wrapContext(context || {}),
                { $: helpers, [`$${contextKey}`]: helpers },
              )
            },
            pushResponseMeta: (type, data) => {
              actionMeta = { type, data }
            },
            runChildren: async (opts) => {
              if (!step.childScope) return []
              let shouldStop = false
              const stop = () => shouldStop = true

              this.#cursor = ExecutionCursor.push(this.cursor)
              if (opts.beforeAll) opts.beforeAll({ cursor: this.cursor, stop })

              while(!shouldStop) {
                if (opts.beforeStep) opts.beforeStep({ cursor: this.cursor, stop })
                if (shouldStop) break
                await this.runNext({ afterStep, runAll })
                if (opts.afterStep) opts.afterStep({ cursor: this.cursor, stop })
                if (shouldStop) break
              }

              const results = ctx.getScopedContext()

              if (opts.afterAll) opts.afterAll({ cursor: this.cursor, stop })
              this.#cursor = ExecutionCursor.pop(this.cursor)

              return results
            },
            useEnv: () => {
              return this.env
            },
            useStream: () => {
              return actionStream!
            },
          }

          helpers = toGetters(typeof action.helpers === 'function'
            ? action.helpers(ctx)
            : action.helpers
          )

          const props = Object.entries(actionNode.attributes).reduce((props, [key, val]) => {
            if (isExpression(val)) {
              Object.defineProperty(props, key, {
                get: () => {
                  // todo - wrap this is some kind of cache mechanism
                  return evalExpression(val, {
                    ...context,
                    $: helpers,
                    [`$${contextKey}`]: helpers
                  })
                },
                enumerable: true,
                configurable: true,
              })
            } else {
              props[key] = val
            }
            return props
          }, {} as any)

          const result = await action.execute(ctx, props)

          resolve({
            cursor,
            name: action.name,
            contextKey,
            result,
            meta: actionMeta,
          })
        })
      })
    }

    // This is fired before the actionPromise starts
    this.#events.emit('step', step, {
      action: actionPromise,
      content: stringifyContext(content),
      stream: actionStream,
    }, cursor)

    // Here we wait for the actionPromise to resolve,
    // and remove the stream to ensure it is not stored in state
    const result: StepResult = {
      action: await actionPromise,
      content,
    }

    this.state.pushResult(cursor, result)

    // Is it the final phase/action
    if (
      cursor.path === '/' &&
      cursor.phaseIndex === scope.phases.length - 1 &&
      cursor.stepIndex === scope.phases[cursor.phaseIndex].steps.length - 1
    ) {
      this.status = ExecutionStatus.Completed
      this.#events.emit('complete', this.getFinalOutput(), cursor)
    } else {
      this.advanceCursor()
      if (!runAll) this.status = ExecutionStatus.Paused
    }

    if (typeof afterStep === 'function') {
      await afterStep(result, cursor)
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

    if (this.cursor.toString() === '/0.0.0') {
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

  getFinalResults(): Iterable<[ExecutionCursor, StepResult]> {
    if (this.status !== ExecutionStatus.Completed) {
      throw new Error(`Cannot get results whilst status is ${ExecutionStatus[this.status]}.`)
    }

    return this.state.iterateResults()
  }

  getFinalOutput(): string {
    const chunks: string[] = []
    let prevCursor: ExecutionCursor | undefined

    for (const [cursor, result] of this.getFinalResults()) {
      const step = this.#walker.findStep(cursor)
      const stepChunks: string[] = []

      if (result.content.length) {
        stepChunks.push(stringifyContext(result.content))
      }

      // For steps without a child scope, include the action result directly.
      // Steps with child scopes are skipped as their results will appear in
      // subsequent steps.
      if (result.action?.result !== undefined && !step?.childScope) {
        stepChunks.push(stringifyContext(result.action.result))
      }

      if (prevCursor && stepChunks.length  && (
        prevCursor.path !== cursor.path ||
        prevCursor.iteration !== cursor.iteration ||
        prevCursor.phaseIndex !== cursor.phaseIndex
      )) {
        stepChunks.unshift('---')
      }

      chunks.push(...stepChunks)
      prevCursor = cursor
    }

    return chunks.join('\n\n')
  }

  // Moves the cursor to the next action or phase within the current scope.
  private advanceCursor(): void {
    const cursor = this.cursor
    const scope = this.#walker.assert.findScope(cursor)

    if (cursor.stepIndex < scope.phases[cursor.phaseIndex].steps.length - 1) {
      this.#cursor = ExecutionCursor.move(cursor, [
        cursor.iteration,
        cursor.phaseIndex,
        cursor.stepIndex + 1,
      ])
    } else if (cursor.phaseIndex < scope.phases.length - 1) {
      this.#cursor = ExecutionCursor.move(cursor, [
        cursor.iteration,
        cursor.phaseIndex + 1,
        0,
      ])
    } else if (!!scope.parentNode) {
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
    this.state.rewind(cursor)
  }
}

function isExpression(val: any): val is ExpressionNode {
  return typeof val === 'object' && val.type === 'expression' && !!val.data
}

function toGetters(props?: Record<string, () => any>): Record<string, any> {
  if (typeof props === 'undefined') return {}
  return Object.entries(props).reduce((getters, [name, fn]) => {
    Object.defineProperty(getters, name, {
      get: () => typeof fn === 'function' ? fn() : fn,
      enumerable: true,
      configurable: true,
    })
    return getters
  }, {})
}

/**
 * Represents the current state of workflow execution.
 */
export enum ExecutionStatus {
  /** Initial state, cursor at /0.0.0 */
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

// Types

export interface ExecutionContext {
  content: ContextValue[],
  getCursor: () => ExecutionCursor,
  getScopedContext: () => Context[],
  getPhaseResults: () => StepResult[],
  pushContext: (context?: Context) => void
  pushResponseMeta: (type: string, data: any) => void,
  runChildren: (opts: {
    beforeAll?: (opts: RunChildrenCallbackOpts) => void,
    beforeStep?: (opts: RunChildrenCallbackOpts) => void,
    afterStep?: (opts: RunChildrenCallbackOpts) => void,
    afterAll?: (opts: RunChildrenCallbackOpts) => void,
  }) => Promise<Context[]>,
  useEnv: () => Environment,
  useStream: () => Pushable<string>,
}

type RunChildrenCallbackOpts = {
  cursor: ExecutionCursor,
  stop: () => void,
}

/**
 * Events emitted during workflow execution.
 */
export interface ExecutionEvents {
  /** Status has changed */
  'status': (status: ExecutionStatus, cursor: ExecutionCursor) => void;

  /** A new phase is starting */
  'phase': (phase: WorkflowPhase, cursor: ExecutionCursor) => void;

  /** Action is starting */
  'step': (step: WorkflowStep, event: StepEvent, cursor: ExecutionCursor) => void;

  /** The runner has completed  */
  'complete': (output: string, cursor: ExecutionCursor) => void;

  /** The runner has errors */
  'error': (error: Error, cursor: ExecutionCursor) => void;

  /** The cursor has been rewound */
  'rewind': (cursor: ExecutionCursor) => void;
}

export interface StepEvent {
  content: string;
  action?: Promise<ActionResult>;
  stream?: Pushable<string>;
}

/**
 * Callback function executed after each action in the workflow.
 */
export type AfterStepCallback =
  (result: StepResult, cursor: ExecutionCursor) => void | Promise<void>
