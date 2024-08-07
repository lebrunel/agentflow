import { is } from 'unist-util-is'
import { visit } from 'unist-util-visit'
import { validateActionNode, type ContextNode, type PhaseNode } from './ast'
import type { ContextMap } from './context'
import {  } from './action'
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

  private validateDependency(node: ContextNode) {
    if (!this.inputs.has(node.value)) {
      throw new Error(dd`
      Dependency not met as line ${node.position!.start.line}.
        Error: @${node.value} not found in phase inputs.
      `)
    }
  }
}

