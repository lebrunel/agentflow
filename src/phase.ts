import { is } from 'unist-util-is'
import { visit } from 'unist-util-visit'
import type { RootContent } from 'mdast'
import { validateActionNode, type ContextNode, type PhaseNode } from './ast'
import type { ContextMap2 } from './context'
import type { Action } from './actions/action'
import { createAction } from './actions'
import { default as dd } from 'ts-dedent'

/**
 * **Phase** -  A sub-section of a Workflow, representing a mini-program that
 * can utilize context from previous phases.
 */
export class Phase {
  cursor: number = 0
  actions: Action[] = []
  dependencies: Set<string> = new Set()
  inputs: ContextMap2 = new Map()
  outputs: ContextMap2 = new Map()
  #ast: PhaseNode;

  constructor(ast: PhaseNode, inputs: ContextMap2) {
    this.#ast = ast
    this.inputs = new Map(inputs)
    
    // walk ast to collect outpus and dependenies
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

    // iterate ast children to build action pointers
    for (let i = 0; i < ast.children.length; i++) {
      const node = ast.children[i]
      if (is(node, 'action')) {
        this.actions.push(createAction(node, ast.children.slice(this.cursor, i)))
        this.cursor = i + 1
      }
    }
  }

  get trailingNodes(): RootContent[] {
    return this.#ast.children.slice(this.cursor)
  }

  //get actions(): Iterable<Action> {
  //  return {
  //    [Symbol.iterator]: () => this.actionIterator(),
  //  }
  //}
  //
  //private *actionIterator(): Generator<Action, void, undefined> {
  //  const nodes = this.#ast.children
  //  let cursor = 0
  //
  //  for (let i = 0; i < nodes.length; i++) {
  //    const node = nodes[i]
  //    if (is(node, 'action')) {
  //      yield new Action(node, nodes.slice(cursor, i))
  //      cursor = i + 1
  //    }
  //  }
  //}

  //getAction(name: string): Action | undefined
  //getAction(index: number): Action | undefined
  //getAction(search: string | number): Action | undefined {
  //  let record = typeof search === 'string'
  //    ? this.actionsRefs.find(a => a.name === search)
  //    : this.actionsRefs[search]
  //  
  //  if (typeof record === 'undefined') {
  //    console.error(`No action found for lookup: ${search}`)
  //    return
  //  }
  //
  //  const node = this.#ast.children[record.index] as ActionNode
  //  const content = this.#ast.children.slice(record.start, record.index)
  //  return new GenerateAction(node, content)
  //}

  private validateDependency(node: ContextNode) {
    if (!this.inputs.has(node.value)) {
      throw new Error(dd`
      Dependency not met as line ${node.position!.start.line}.
        Error: @${node.value} not found in phase inputs.
      `)
    }
  }
}

interface ActionRef {
  name: string;
  index: number;
  start: number;
}