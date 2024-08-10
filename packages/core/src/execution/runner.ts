import { createNanoEvents, type Unsubscribe } from 'nanoevents'
import { ExecutionState, ExecutionStatus } from './state'
import { dd } from '../util'

import type { Action, ActionResult } from '../action'
import type { ContextValueMap } from '../context'
import type { Phase } from '../phase'
import type { Workflow } from '../workflow'

export class ExecutionRunner {
  #status = ExecutionStatus.Paused
  #events = createNanoEvents<ExecutionEvents>()
  readonly workflow: Workflow;
  readonly state: ExecutionState;

  constructor(workflow: Workflow, input: ContextValueMap) {
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

  getFinalResult() {
    if (this.#status !== ExecutionStatus.Success) {
      console.error(dd`
      Cannot get results whilst status is ${ExecutionStatus[this.status]}.
      `)
      return
    }

    let resultChunks: string[] = []

    for (let i = 0; i < this.workflow.phases.length; i++) {
      const phase = this.workflow.phases[i]
      const phaseResults = this.state.getPhaseResults(i)
      const trailingNodes = phase.trailingNodes

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
        // todo - add compiled trailing nodes (insertContext)
      }

      if (i < this.workflow.phases.length - 1) {
        resultChunks.push('---')
      }
    }

    return resultChunks.join('\n\n')
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

