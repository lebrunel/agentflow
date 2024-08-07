import { is } from 'unist-util-is'
import { visit } from 'unist-util-visit'
import { validateActionNode, type ActionNode, type ContextNode, type PhaseNode } from './ast'
import type { ContextMap } from './context'
import { Action } from './action'
import { default as dd } from 'ts-dedent'

/**
 * **Phase** -  A sub-section of a Workflow, representing a mini-program that
 * can utilize context from previous phases.
 */
export class Phase {
  dependencies: Set<string> = new Set()
  inputs: ContextMap = new Map()
  outputs: ContextMap = new Map()
  #ast: PhaseNode;

  constructor(ast: PhaseNode, inputs: ContextMap) {
    this.#ast = ast
    this.inputs = new Map(inputs)

    visit(ast, node => {
      if (is(node, 'action')) {
        validateActionNode(node)
        this.outputs.set(node.data.name, 'text')
      }
      if (is(node, 'context')) {
        this.validateDependency(node)
        this.dependencies.add(node.value)
      }
    })
  }

  get actions(): Iterable<Action> {
    return {
      [Symbol.iterator]: () => this.actionIterator(),
    }
  }

  private *actionIterator(): Generator<Action, void, undefined> {
    const nodes = this.#ast.children
    let cursor = 0

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (is(node, 'action')) {
        yield new Action(node, nodes.slice(cursor, i))
        cursor = i + 1
      }
    }
  }

  private validateDependency(node: ContextNode) {
    if (!this.inputs.has(node.value)) {
      throw new Error(dd`
      Dependency not met as line ${node.position!.start.line}.
        Error: @${node.value} not found in phase inputs.
      `)
    }
  }
}

