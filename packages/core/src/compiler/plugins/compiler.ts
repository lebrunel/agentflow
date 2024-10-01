import { is } from 'unist-util-is'
import { visit, CONTINUE, SKIP } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { VFile } from 'vfile'
import { evalDependencies, WorkflowInputSchema } from '../../runtime'
import { Workflow } from '../../workflow'

import type { Program, Property } from 'estree-jsx'
import type { Root, RootContent } from 'mdast'
import type { Plugin, Processor } from 'unified'
import type { ActionNode, ExpressionNode, PhaseNode, WorkflowNode } from '../ast'
import type { CompileOptions } from '../compiler'
import type { ContextKey } from '../../context'
import type { WorkflowPhase, WorkflowAction } from '../../workflow'

/**
 * Compiles a workflow from a markdown AST node into a Workflow object.
 * This function processes the markdown structure, extracts metadata,
 * parses input schemas, and builds a series of workflow phases and actions.
 * It handles title extraction, description parsing, and context type management.
 */
export const workflowCompiler: Plugin<[CompileOptions], WorkflowNode, Workflow> = function(
  this: Processor,
  _options: CompileOptions,
) {
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

    // Collect phases
    let contextKeys: ContextKey[] = Object.keys(inputSchema)
    const phases: WorkflowPhase[] = []
    for (const node of workflowNode.children.filter(n => n.type === 'phase')) {
      const phase = workflowPhase(node as PhaseNode, contextKeys, file)
      phases.push(phase)
      contextKeys = Array.from(phase.contextKeys)
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

// Maps the PhaseNode into a WorkflowPhase interface
function workflowPhase(
  phaseNode: PhaseNode,
  inputKeys: ContextKey[],
  file: VFile,
): WorkflowPhase {
  const actions: WorkflowAction[] = []
  const contextKeys = new Set<string>(inputKeys)

  function validateDependency(node: ExpressionNode, contextKey: string, computedKeys: string[] = []) {
    if (
      !contextKeys.has(contextKey) &&
      !computedKeys.includes(contextKey) &&
      !['z'].includes(contextKey)
    ) {
      file.fail(
        `Unknown context "${contextKey}". This Action depends on a context that hasn't been defined earlier in the workflow.`,
        node,
        'workflow-parse:undefined-context'
      )
    }
  }

  function validateUniqueness(node: ActionNode, contextKey: string) {
    if (contextKeys.has(contextKey)) {
      file.fail(
        `Duplicate context name "${contextKey}". Each Action must have a unique name within the workflow.`,
        node,
        'workflow-parse:duplicate-context'
      )
    }
  }

  // The visitor scans the tree in order, so it's important that actions are
  // added to the outputTypes BEFORE expression dependencies are validated
  visit(phaseNode, (node, _i, parent) => {
    // Ensure we don't traverse nested action scopes
    if (is(parent, 'action')) return SKIP

    if (is(node, 'action')) {
      for (const attr of Object.values(node.attributes)) {
        if (is(attr, 'expression')) {
          const expr = attr as ExpressionNode
          const program = expr.data!.estree! as Program
          for (const name of evalDependencies(program)) {
            validateDependency(expr, name, getActionComputedContextKeys(node))
          }
        }
      }

      const contextKey = node.attributes.as
      validateUniqueness(node, contextKey)
      contextKeys.add(contextKey)
      return CONTINUE
    }

    if (is(node, 'expression') && node.data?.estree) {
      const program = node.data!.estree! as Program
      for (const name of evalDependencies(program)) {
        validateDependency(node, name)
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
    contextKeys,
    trailingNodes,
  }
}

// Maps the ActionNode into a WorkflowAction interface
function workflowAction(
  actionNode: ActionNode,
  contentNodes: RootContent[],
  file: VFile,
): WorkflowAction {
  const contextKey = actionNode.attributes.as
  const props = { ...actionNode.attributes }
  const phases: WorkflowPhase[] = []

  if (actionNode.children.length) {
    let contextKeys: ContextKey[] = contextKeysFromExpression(actionNode.attributes.provide)
    contextKeys.push(...getActionComputedContextKeys(actionNode))
    for (const node of actionNode.children.filter(n => n.type === 'phase')) {
      const phase = workflowPhase(node, contextKeys, file)
      phases.push(phase)
      contextKeys = Array.from(phase.contextKeys)
    }
  }

  return {
    name: actionNode.name,
    contextKey,
    contentNodes,
    props,
    phases,
  }
}

function getActionComputedContextKeys(node: ActionNode): string[] {
  switch(node.name) {
    case 'if':
      return ['$self']
    case 'loop':
      return ['$self', '$index', '$last']
    default:
      return []
  }
}

function contextKeysFromExpression(attr: any): string[] {
  if (attr && attr?.data?.estree) {
    const tree = attr?.data?.estree as Program
    const last = tree.body[tree.body.length - 1]
    if (last.type === 'ExpressionStatement' && last.expression.type === 'ObjectExpression') {
      return last.expression.properties
        .filter((prop): prop is Property => prop.type === 'Property')
        .map(prop => {
          if (prop.key.type === 'Identifier') {
            return prop.key.name
          } else if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') {
            return prop.key.value
          }
          return null
        })
        .filter((name): name is string => typeof name === 'string')
    }
  }
  return []
}
