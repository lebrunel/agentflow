import { default as dd } from 'ts-dedent'
import { createNanoEvents, type Unsubscribe } from 'nanoevents'
import { ExecutionState } from './state'
import type { Action, ActionResult } from './actions/action'
import type { ContextMap } from '@ada/core/src/context'
import type { Workflow } from '@ada/core/src/workflow'
import type { Phase } from '@ada/core/src/phase'

export class ExecutionRunner {
  #status = ExecutionStatus.Paused
  #events = createNanoEvents<ExecutionEvents>()
  workflow: Workflow;
  state: ExecutionState;

  constructor(workflow: Workflow, input: ContextMap) {
    this.workflow = workflow
    this.state = new ExecutionState(workflow, input)
  }

  get status(): ExecutionStatus {
    return this.#status
  }

  private set status(val: ExecutionStatus) {
    this.#status = val
    this.#events.emit('status', val, this.state)
  }

  async run() {
    if (this.status !== ExecutionStatus.Paused) {
      console.error(dd`
      Runner error. Cannot start runner whilst status is ${ExecutionStatus[this.status]}.
      `)
      return
    }

    let prevPhase: Phase | undefined

    while (!this.state.isDone) {
      const phase = this.workflow.phases[this.state.cursor[0]]      

      if (phase !== prevPhase) {
        this.#events.emit('phase', phase, prevPhase, this.state)
      }

      try {
        const action = phase.actions[this.state.cursor[1]]
        this.#events.emit('action.call', action, this.state)

        const result = await action.execute(
          this.state.getContext(),
          this.state.getPhaseResults(),
        )

        this.state.pushResult(result)
        this.#events.emit('action.result', result, this.state)
        this.state.next()
        prevPhase = phase
      } catch(error) {
        // todo - error handling tbc
        this.#events.emit('error', error as Error, this.state)
        this.status = ExecutionStatus.Error
        break
      }
    }

    if (this.state.isDone) {
      console.log('DONE!')
      this.status = ExecutionStatus.Success
      this.#events.emit('success', this.state)
    }
  }

  pause() {
    if (this.status !== ExecutionStatus.Running) {
      console.error(`Cannot pause runner with status: ${ExecutionStatus[this.status]}.`)
      return
    }

    this.status = ExecutionStatus.Paused
  }

  rewind(position: string) {
    if (this.status === ExecutionStatus.Running) {
      console.error(`Cannot rewind runner when running. Use 'runner.pause()' first.`)
      return
    }
    if (!/^\d+\.\w+$/.test(position)) {
      throw new Error(`Invalid format. Please use 'phase.action' (eg. '2.summary').`)
    }

    this.state.rewind(position)
  }

  on<E extends keyof ExecutionEvents>(
    event: E,
    handler: ExecutionEvents[E],
  ): Unsubscribe {
    return this.#events.on(event, handler)
  }
}

export interface ExecutionEvents {
  'status': (status: ExecutionStatus, state: ExecutionState) => void;
  'success': (state: ExecutionState) => void;
  'error': (error: Error, state: ExecutionState) => void;
  'phase': (phase: Phase, prev: Phase | undefined, state: ExecutionState) => void;
  'action.call': (action: Action, state: ExecutionState) => void;
  'action.result': (result: ActionResult, state: ExecutionState) => void;
}

export enum ExecutionStatus {
  Error = -1,
  Paused,
  Running,
  Success,
}
