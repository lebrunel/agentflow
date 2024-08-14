import { is } from 'unist-util-is'
import { visit } from 'unist-util-visit'
import type { RootContent } from 'mdast'

import { Action } from '~/compiler/action'
import { isActionNode } from '~/compiler/ast'
import type { ContextNode, PhaseNode } from '~/compiler/ast'
import type { ContextTypeMap } from '~/runtime/context'

/**
 * **Phase** -  A sub-section of a Workflow, representing a mini-program that
 * can utilize context from previous phases.
 */
export class Phase {
  readonly actions: Action[] = []
  readonly dependencies: Set<string> = new Set()
  readonly inputTypes: ContextTypeMap
  readonly outputTypes: ContextTypeMap = {}
  readonly trailingNodes: RootContent[]

  constructor(ast: PhaseNode, inputTypes: ContextTypeMap) {
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
    let cursor = 0
    for (let i = 0; i < ast.children.length; i++) {
      const node = ast.children[i]
      if (isActionNode(node)) {
        const action = new Action(node, ast.children.slice(cursor, i))
        this.actions.push(action)
        cursor = i + 1
      }
    }

    // caputure remaining nodes
    this.trailingNodes = ast.children.slice(cursor)
  }

  private validateDependency(node: ContextNode) {
    // todo - improve this is it will validate future outputs in same phase
    // it should throw is the context appears before the output
    if (!this.inputTypes[node.value] && !this.outputTypes[node.value]) {
      throw new Error(`Dependency '@${node.value}' not met. Line ${node.position!.start.line}.`)
    }
  }
}

