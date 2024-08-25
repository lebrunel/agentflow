import { is } from 'unist-util-is'
import { visit, CONTINUE } from 'unist-util-visit'
import { selectAll } from 'unist-util-select'
import { toString } from 'mdast-util-to-string'
import { VFile } from 'vfile'
import type { Program } from 'estree-jsx'
import type { Root, RootContent } from 'mdast'
import type { Plugin, Processor } from 'unified'

import { WorkflowInputSchema } from '../../workflow/inputs'
import { Workflow } from '../../workflow/workflow'
import { evalDependencies } from '../../runtime/eval'
import type { ContextTypeMap } from '../../workflow/context'
import type { WorkflowPhase, WorkflowAction } from '../../workflow/workflow'
import type { ActionNode, ExpressionNode, PhaseNode, WorkflowNode } from '../ast'

export const workflowCompiler: Plugin<[], WorkflowNode, Workflow> = function(this: Processor) {
  this.compiler = function(node, file) {
    const workflowNode = node as WorkflowNode
    const workflowRoot = workflowNode.children[0] as Root
    const yaml = workflowRoot.children.find(n => is(n, 'yaml'))
    const meta = (yaml?.data || {}) as Record<string, any>

    const titleIdx = yaml ? 1 : 0
    const firstNode = workflowRoot.children.length > titleIdx
      ? workflowRoot.children[titleIdx]
      : workflowNode.children[1].children[0]
    const titleNode = is(firstNode, 'heading')
      ? firstNode
      : undefined

    // Get the title, with fallback
    const title = meta?.title
      || (titleNode && toString(titleNode))
      || file?.basename
      || 'Untitled'

    const descriptionNodes = workflowRoot.children.slice(titleIdx)
    const inputSchema: WorkflowInputSchema = meta?.inputs || {}

    // Create mutatable ContextTypeMap
    const contextTypes: ContextTypeMap =
      Object.entries(inputSchema).reduce((map, [name, { type }]) => {
        return Object.assign(map, { [name]: type })
      }, {})

    // Collect phases
    const phases: WorkflowPhase[] = []
    for (const node of selectAll('phase', workflowNode)) {
      const phase = workflowPhase(node as PhaseNode, contextTypes, file)
      phases.push(phase)
      Object.assign(contextTypes, phase.outputTypes)
    }

    return new Workflow(
      title,
      descriptionNodes,
      inputSchema,
      phases,
      meta,
    )
  }
}

function workflowPhase(phaseNode: PhaseNode, contextTypes: ContextTypeMap, file: VFile): WorkflowPhase {
  const actions: WorkflowAction[] = []
  const dependencies = new Set<string>()
  const inputTypes = { ...contextTypes }
  const outputTypes: ContextTypeMap = {}

  function validateDependency(node: ExpressionNode, contextName: string) {
    if (!inputTypes[contextName] && !outputTypes[contextName]) {
      file.fail(
        `Unknown context "${contextName}". This Action depends on a context that hasn't been defined earlier in the workflow.`,
        node,
        'workflow-parse:undefined-context'
      )
    }
  }

  function validateUniqueness(node: ActionNode, contextName: string) {
    if (contextName in inputTypes) {
      file.fail(
        `Duplicate context name "${contextName}". Each Action must have a unique name within the workflow.`,
        node,
        'workflow-parse:duplicate-context'
      )
    }
  }

  visit(phaseNode, node => {
    if (is(node, 'action')) {
      const contextName = node.attributes.name
      validateUniqueness(node, contextName)
      outputTypes[contextName] = 'text' // todo - this should come from the runtime action
      return CONTINUE
    }

    if (is(node, 'expression') && node.data?.estree) {
      const program = node.data!.estree! as Program
      for (const name of evalDependencies(program)) {
        validateDependency(node, name)
        dependencies.add(name)
      }
    }
  })

  // iterate ast children to build action pointers
  let cursor = 0
  for (let i = 0; i < phaseNode.children.length; i++) {
    const node = phaseNode.children[i]
    if (is(node, 'action')) {
      const action = workflowAction(node, phaseNode.children.slice(cursor, i), file)
      actions.push(action)
      cursor = i + 1
    }
  }

  // caputure remaining nodes
  const trailingNodes = phaseNode.children.slice(cursor)

  return {
    actions,
    dependencies,
    inputTypes,
    outputTypes,
    trailingNodes,
  }
}

function workflowAction(actionNode: ActionNode, contentNodes: RootContent[], _file: VFile): WorkflowAction {
  return {
    name: actionNode.name,
    contextName: actionNode.attributes.name,
    contentNodes,
    props: actionNode.attributes
  }
}
