import { default as dd } from 'ts-dedent'
import { ExecutionState } from './execution'
import type { ContextMap } from './context'
import type { Workflow } from './workflow'

export class Runner {
  status = RunStatus.Paused;
  workflow: Workflow;
  #state: ExecutionState;

  constructor(workflow: Workflow, input: ContextMap) {
    this.workflow = workflow
    this.#state = new ExecutionState(workflow, input)
  }

  async run() {
    if (this.status !== RunStatus.Paused) {
      console.error(dd`
      Runner error. Cannot start runner whilst status is ${RunStatus[this.status]}.
      `)
      return
    }

    while (!this.#state.isFinished) {
      const phase = this.workflow.phases[this.#state.cursor[0]]
      const action = phase.getAction(this.#state.cursor[1])

      try {
        // todo - execution
        //const result = this.actionExecutor.execute(action)
        //this.#state.setActionResult(result)
        
      } catch(e) {
        // todo - handle error
        console.error(e)
        this.status = RunStatus.Error
      } finally {
        this.#state.next()
      }
    }

    this.status = RunStatus.Success
  }

  pause() {
    if (this.status !== RunStatus.Running) {
      console.error(dd`
      Runner error. Cannot pause runner with status: ${RunStatus[this.status]}.
      `)
      return
    }
  }

  rewind(position: string) {
    if (this.status === RunStatus.Running) {
      console.error(dd`
      Runner error. Cannot rewind runner with status: ${RunStatus[this.status]}.
      `)
      return
    }

    this.#state.rewind(position)
  }
}

export enum RunStatus {
  Error = -1,
  Paused,
  Running,
  Success,
}