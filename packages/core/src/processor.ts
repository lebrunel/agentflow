import { unified } from 'unified'
import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { selectAll } from 'unist-util-select'
import { visit } from 'unist-util-visit'
import { parse as parseYAML } from 'yaml'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import remarkFrontmatter from 'remark-frontmatter'
import { isActionNode } from './ast'
import { Workflow } from './workflow'

import type { Processor, Transformer } from 'unified'
import type { Code, InlineCode, Node, PhrasingContent, Root, RootContent, ThematicBreak, Yaml } from 'mdast'
import type { WorkflowNode, PhaseNode } from './ast'
import type { ContextValue, ContextValueMap } from './context'

/**
 * Creates a unified processor for transforming Markdown into a structured
 * workflow representation.
 */
export function useProcessor(): Processor<Root, Root, WorkflowNode, WorkflowNode, Workflow> {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(customNodes)
    .use(groupPhases)
    .use<[], WorkflowNode, Workflow>(workflowCompiler)
}

export function stringifyWithContext(content: RootContent[], context: ContextValueMap): string {
  return unified()
    .use(insertContext, context)
    .use(remarkStringify)
    .stringify(u('root', content))
    .trim()
}

// Plugins

// Walks the AST tree and processes custom node types (actions, contexts).
function customNodes(): Transformer<Root> {
  return function(root) {
    visit(root, (node, i, parent) => {
      if (typeof i === 'undefined') return

      if (is(node, 'yaml')) {
        const nodeT = node as Yaml
        node.data = parseYAML(nodeT.value)
      }

      if (isActionDef(node)) {
        const parentT = parent as {children: RootContent[]}

        const match = node.lang!.match(/^(\w+)@(\w+)/) as RegExpMatchArray
        const type = match[1]
        const name = match[2]
        const props = parseYAML(node.value)
        
        parentT.children[i] = u('action', {
          data: { type, name, props },
          value: node.value,
          position: node.position,
        })
        return 'skip'
      }

      if (isContextDef(node)) {
        const parentT = parent as {children: PhrasingContent[]}

        parentT.children[i] = u('context', {
          value: node.value.replace(/^@/, ''),
          position: node.position,
        })
        return 'skip'
      }
    })
  }
}

// Iterates over root children, grouping nodes content into phases.
function groupPhases(): Transformer<Root, WorkflowNode> {
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

function insertContext(context: ContextValueMap): Transformer<Root> {
  return root => {
    visit(root, 'context', (node, i, parent) => {
      // todo - handle different ContextValue types
      const contextValue = context[node.value] as ContextValue & { type: 'text' }
      parent!.children[i as number] = u('text', { value: contextValue.text })
      return 'skip'
    })
  }
}


// Attaches a compiler to the processor.
function workflowCompiler(this: Processor) {
  this.compiler = (node, file) => Workflow.compile(node as WorkflowNode, file)
}

// Helpers

function isActionDef(node: Node): node is Code {
  return is(node, n => n.type === 'code' && hasActionIdentifier(n as Code))
}

function hasActionIdentifier(node: Code): boolean {
  const match = node.lang?.match(/^(\w+)@(\w+)/)
  return !!match && ['generate'].includes(match[1])
}

function isContextDef(node: Node): node is InlineCode {
  return is(node, n => n.type === 'inlineCode' && /^@\w+/.test((n as InlineCode).value))
}

function isSectionDivider(node: Node): node is ThematicBreak {
  return is(node, 'thematicBreak')
}
