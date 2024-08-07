import { unified, type Processor, type Transformer } from 'unified'
import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { selectAll } from 'unist-util-select'
import { visit } from 'unist-util-visit'
import { parse as parseYAML } from 'yaml'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import type { Code, InlineCode, Node, Paragraph, Parent, Root, RootContent, ThematicBreak } from 'mdast'
import { isActionNode, type WorkflowNode, type PhaseNode } from './ast'

export function parseProcessor(): Processor<Root, Root, WorkflowNode> {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(workflowVisitor)
    .use(workflowPhases)
}

function workflowVisitor(): Transformer<Root> {
  return function(root) {
    visit(root, (node, i, parent) => {
      if (typeof i === 'undefined') return

      if (is(node, 'yaml')) {
        node.data = parseYAML(node.value)
      }

      if (isActionDef(node)) {
        (parent as Parent).children[i] = u('action', {
          data: parseYAML(node.value),
          value: node.value,
          position: node.position,
        })
        return 'skip'
      }

      if (isContextDef(node)) {
        (parent as Paragraph).children[i] = u('context', {
          value: node.value.replace(/^@/, ''),
          position: node.position,
        })
        return 'skip'
      }
    })
  }
}

function workflowPhases(): Transformer<Root, WorkflowNode> {
  return function(root) {
    const workflow: WorkflowNode = u('workflow', [])
    const workflowRoot: Root = u('root', [])
    const nodes = root.children
    let cursor = 0

    function processNodes(group: RootContent[]) {
      const isFirst = selectAll('phase', workflow).length < 1
      const hasAction = group.some(isActionNode)

      if (isFirst && !hasAction) {
        workflowRoot.children.push(...group)
      } else {
        const phase: PhaseNode = u('phase', group)
        workflow.children.push(phase)
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]

      if (i == 0 && is(node, 'yaml')) {
        workflowRoot.children.push(node)
        cursor = 1
      }

      if (isSectionDivider(node)) {
        if (i > cursor) processNodes(nodes.slice(cursor, i))
        cursor = i + 1
      }
    }

    // process last section
    if (cursor < nodes.length) processNodes(nodes.slice(cursor))
    // maybe prepend root
    if (workflowRoot.children.length) workflow.children.unshift(workflowRoot)

    return workflow
  }
}

function isActionDef(node: Node): node is Code {
  return is(node, { type: 'code', lang: 'generate' })
}

function isContextDef(node: Node): node is InlineCode {
  return is(node, n => n.type === 'inlineCode' && /^@\w+/.test((n as InlineCode).value))
}

function isSectionDivider(node: Node): node is ThematicBreak {
  return is(node, 'thematicBreak')
}
