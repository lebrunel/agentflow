import { default as dd } from 'ts-dedent'
import { ExecutionState } from './state'
import type { ContextMap } from '../context'
import type { Workflow } from '../workflow'

export class ExecutionRunner {
  status = ExecutionStatus.Paused;
  workflow: Workflow;
  state: ExecutionState;

  constructor(workflow: Workflow, input: ContextMap) {
    this.workflow = workflow
    this.state = new ExecutionState(workflow, input)
  }

  async run() {
    if (this.status !== ExecutionStatus.Paused) {
      console.error(dd`
      Runner error. Cannot start runner whilst status is ${ExecutionStatus[this.status]}.
      `)
      return
    }

    while (!this.state.isFinished) {
      const phase = this.workflow.phases[this.state.cursor[0]]      

      try {
        const action = phase.actions[this.state.cursor[1]]
        const result = await action.execute(
          this.state.getContext(),
          this.state.getPhaseResults(),
        )
        this.state.pushResult(result)
      } catch(e) {
        // todo - error handling tbc
        console.error(e)
        this.status = ExecutionStatus.Error
      } finally {
        this.state.next()
      }
    }

    this.status = ExecutionStatus.Success
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
}

export enum ExecutionStatus {
  Error = -1,
  Paused,
  Running,
  Success,
}
