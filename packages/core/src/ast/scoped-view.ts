import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { selectAll } from 'unist-util-select'

import type { RootContent } from 'mdast'
import type {
  ActionNode,
  ExpressionNode,
  WorkflowScope,
  WorkflowPhase,
  WorkflowStep,
  WorkflowWalker,
} from './types'

/**
 * TODO
 */
export function createScopedView(
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
      startPosition = i+1
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
  const steps: WorkflowStep[] = []
  let startPosition = 0

  nodes.forEach((node, i) => {
    if (is(node, 'action')) {
      const step = createStep(nodes.slice(startPosition, i), node)
      steps.push(step)
      startPosition = i+1
    }
  })

  // process last block
  if (startPosition < nodes.length) {
    const step = createStep(nodes.slice(startPosition))
    steps.push(step)
  }

  return { steps }
}

function createStep(
  nodes: RootContent[],
  action?: ActionNode,
): WorkflowStep {
  const content = u('root', nodes)
  const expressions = selectAll('expression', content) as ExpressionNode[]
  const childScope = action?.children.length
    ? createScopedView(action.children, action)
    : undefined

  return { content, expressions, action, childScope }
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
    phase.steps.forEach(step => handleStep(step, context))
  }

  function handleStep(step: WorkflowStep, context: T) {
    if (typeof walker.onStep === 'function') walker.onStep(step, context)
    if (step.childScope) handleScope(step.childScope, context)
  }

  handleScope(scope, {} as T)
}
