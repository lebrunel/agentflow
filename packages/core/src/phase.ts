import { is } from 'unist-util-is'
import { visit } from 'unist-util-visit'
import { useAction } from './actions'

import type { RootContent } from 'mdast'
import type { Action, ActionProps } from './action'
import type { ContextTypeMap } from './context'
import type { ActionNode, ContextNode, PhaseNode } from './ast'

/**
 * **Phase** -  A sub-section of a Workflow, representing a mini-program that
 * can utilize context from previous phases.
 */
export class Phase {
  #ast: PhaseNode
  #cursor: number = 0
  readonly actions: Action[] = []
  readonly dependencies: Set<string> = new Set()
  readonly inputTypes: ContextTypeMap
  readonly outputTypes: ContextTypeMap = {}

  constructor(ast: PhaseNode, inputTypes: ContextTypeMap) {
    this.#ast = ast
    this.inputTypes = inputTypes
    
    // walk ast to collect outpus and dependenies
    visit(ast, node => {
      if (is(node, 'action')) {
        this.outputTypes[node.data.name] = 'text'
      }
      if (is(node, 'context')) {
        this.validateDependency(node)
        this.dependencies.add(node.value)
      }
    })

    // iterate ast children to build action pointers
    for (let i = 0; i < ast.children.length; i++) {
      const node = ast.children[i] as ActionNode
      if (is(node, 'action')) {
        const Action = useAction(node.data.type)
        const action = new Action(node, ast.children.slice(this.#cursor, i))
        action.validate()
        this.actions.push(action)
        this.#cursor = i + 1
      }
    }
  }

  get trailingNodes(): RootContent[] {
    return this.#ast.children.slice(this.#cursor)
  }

  private validateDependency(node: ContextNode) {
    if (!this.inputTypes[node.value]) {
      throw new Error(`Dependency '@${node.value}' not met. Line ${node.position!.start.line}.`)
    }
  }
}
