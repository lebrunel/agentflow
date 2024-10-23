import { is } from 'unist-util-is'
import { visit, SKIP } from 'unist-util-visit'

import type { RootContent } from 'mdast'

import type {
  ActionNode,
  ExpressionNode,
  WorkflowScope,
  WorkflowPhase,
  WorkflowAction,
  WorkflowWalker,
} from './types'

/**
 * TODO
 */
export function createScopeTree(
  nodes: RootContent[],
  parentNode?: ActionNode,
): WorkflowScope {
  const phases: WorkflowPhase[] = []
  let startPosition = 0

  nodes.forEach((node, i) => {
    if (i == 0 && is(node, 'yaml')) startPosition = 1

    if (is(node, 'thematicBreak')) {
      if (i > startPosition) {
        const phase = createPhase(nodes.slice(startPosition, i))
        phases.push(phase)
      }
      startPosition = i + 1
    }
  })

  // process last block
  if (startPosition < nodes.length) {
    const phase = createPhase(nodes.slice(startPosition))
    phases.push(phase)
  }

  return { phases, parentNode }
}

function createPhase(nodes: RootContent[]): WorkflowPhase {
  const actions: WorkflowAction[] = []
  const execNodes: Array<ActionNode | ExpressionNode> = []
  let startPosition = 0

  nodes.forEach((rootContentNode, i) => {
    visit(rootContentNode, (node, _i, parent) => {
      // Ensure we don't traverse nested action scopes
      if (is(parent, 'action')) return SKIP

      if (is(node, 'action')) {
        const action = createAction(node, nodes.slice(startPosition, i))
        for (const attr of Object.values(node.attributes)) {
          if (is(attr, 'expression')) execNodes.push(attr as ExpressionNode)
        }
        actions.push(action)
        execNodes.push(node)
        startPosition = i + 1
      }

      if (is(node, 'expression')) {
        execNodes.push(node)
      }
    })
  })

  return { actions, execNodes }
}

function createAction(
  node: ActionNode,
  inputNodes: RootContent[],
): WorkflowAction {
  let childScope: WorkflowScope | undefined

  if (node.children.length) {
    childScope = createScopeTree(node.children, node)
  }

  return { node, inputNodes, childScope }
}

/**
 * TODO
 */
export function walkScopeTree<T extends Record<string, any>>(
  scope: WorkflowScope,
  walker: WorkflowWalker<T>,
): void {
  function handleScope(scope: WorkflowScope, parentCtx: T) {
    const context = typeof walker.onScope === 'function'
      ? walker.onScope(scope, parentCtx)
      : {}
    scope.phases.forEach(phase => handlePhase(phase, context as T))
  }

  function handlePhase(phase: WorkflowPhase, context: T) {
    if (typeof walker.onPhase === 'function') walker.onPhase(phase, context)
    phase.actions.forEach(action => handleAction(action, context))
  }

  function handleAction(action: WorkflowAction, context: T) {
    if (typeof walker.onAction === 'function') walker.onAction(action, context)
    if (action.childScope) handleScope(action.childScope, context)
  }

  handleScope(scope, {} as T)
}
