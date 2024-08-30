import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { visit, CONTINUE, SKIP } from 'unist-util-visit'

import type { Root, RootContent } from 'mdast'
import type { Transformer } from 'unified'
import type { ActionNode, PhaseNode, WorkflowNode } from '../ast'
import type { CompileOptions } from '../compiler'

/**
 * A unified transformer that restructures a markdown AST into a workflow
 * structure. It organizes the content into phases separated by thematic breaks,
 * with special handling for the first section and YAML frontmatter.
 */
export function workflowStructure(options: CompileOptions): Transformer<Root, WorkflowNode> {
  return (tree, _file) => {
    const workflowRoot: Root = u('root', [])
    const workflowNode: WorkflowNode = u('workflow', [workflowRoot])
    const nodes = tree.children
    let cursor = 0

    function processNodes(block: RootContent[]) {
      const isFirst = !workflowNode.children.some(n => is(n, 'phase'))
      const hasAction = block.some(n => is(n, 'action'))

      if (isFirst && !hasAction) {
        workflowRoot.children.push(...block)
      } else {
        workflowNode.children.push(u('phase', block))
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]

      if (i == 0 && is(node, 'yaml')) {
        workflowRoot.children.push(node)
        cursor = 1
      }

      if (is(node, 'thematicBreak')) {
        if (i > cursor) processNodes(nodes.slice(cursor, i))
        cursor = i + 1
      }
    }

    // process last block
    if (cursor < nodes.length) processNodes(nodes.slice(cursor))

    // Group action children into sub-phases
    visit(workflowNode, 'action', actionVisitor)

    return workflowNode
  }
}

/**
 * Visitor function that groups action children by thematic breaks
 */
function actionVisitor(actionNode: ActionNode): true {
  const phases: PhaseNode[] = []
  const nodes = actionNode.children
  let cursor = 0

  function createPhase(block: RootContent[]) {
    phases.push(u('phase', block))
  }

  for (let i = 0; i < actionNode.children.length; i++) {
    const node = actionNode.children[i]

    if (is(node, 'thematicBreak')) {
      if (i > cursor) createPhase(nodes.slice(cursor, i) as RootContent[])
      cursor = i + 1
    }
  }

  // process last block
  if (cursor < nodes.length) createPhase(nodes.slice(cursor) as RootContent[])

  actionNode.children = phases

  return CONTINUE
}
