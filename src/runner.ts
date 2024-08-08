import { default as dd } from 'ts-dedent'
import { ExecutionState, ExecutionStatus } from './execution'
import type { ContextMap } from './context'
import type { Workflow } from './workflow'

export class Runner {
  //#context = new ExecutionContext()
  #state: ExecutionState;
  status = ExecutionStatus.Paused;

  constructor(
    readonly workflow: Workflow,
    input: ContextMap,
  ) {
    this.#state = new ExecutionState(workflow, input)
  }

  async run() {
    if (this.status !== ExecutionStatus.Paused) {
      console.error(dd`
      Runner error. Cannot start runner whilst status is ${ExecutionStatus[this.status]}.
      `)
      return
    }

    while (!this.#state.isFinished) {
      const phase = this.workflow.phases[this.#state.cursor[0]]
      const action = phase.actions[this.#state.cursor[1]]

      try {
        // todo - execution
        //const result = this.actionExecutor.execute(action)
        //this.#state.setActionResult(result)
        
      } catch(e) {
        // todo - handle error
        console.error(e)
        this.status = ExecutionStatus.Error
      } finally {
        this.#state.next()
      }
    }

    this.status = ExecutionStatus.Success
  }

  pause() {
    if (this.status !== ExecutionStatus.Running) {
      console.error(dd`
      Runner error. Cannot pause runner with status: ${ExecutionStatus[this.status]}.
      `)
      return
    }
  }

  rewind(position: string) {
    if (this.status !== ExecutionStatus.Paused) {
      console.error(dd`
      Runner error. Cannot rewind runner with status: ${ExecutionStatus[this.status]}.
      `)
      return
    }

    this.#state.rewind(position)
  }
}
