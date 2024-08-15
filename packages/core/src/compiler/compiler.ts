import { unified } from 'unified'
import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { selectAll } from 'unist-util-select'
import { visit } from 'unist-util-visit'
import { parse as parseYAML } from 'yaml'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import type { Plugin, Processor, Transformer } from 'unified'
import type { VFile } from 'vfile'
import type { PhrasingContent, Root, RootContent, Yaml } from 'mdast'

import { isActionDef, isActionNode, isBreak, isContextDef } from './ast'
import { Workflow } from './workflow'
import { Runtime } from '../runtime/runtime'
import type { WorkflowNode, PhaseNode } from './ast'

export function compileWorkflow(markdown: string | VFile, runtime: Runtime): Workflow {
  const file = compileProcessor(runtime).processSync(markdown)
  if (runtime) {
    // todo - validateWorkflow(file.result, runtime)
  }
  return file.result
}

export function compileProcessor(runtime: Runtime): Processor<Root, Root, WorkflowNode, WorkflowNode, Workflow> {
  return unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml'])
      .use(customNodes, runtime)
      .use(groupPhases)
      .use(createWorkflow)
}

// Plugins

// Walks the AST tree and processes custom node types (actions, contexts).
function customNodes(runtime: Runtime): Transformer<Root> {
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

        try {
          runtime.useAction(type).validate(props)
        } catch(e: any) {
          const start = node.position!.start
          throw new Error(`Parse error at ${start.line}:${start.column}\n${e.message}`)
        }        
        
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

      if (isBreak(node)) {
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

// Attaches a compiler to the processor.
const createWorkflow: Plugin<[], WorkflowNode, Workflow> = function(this: Processor) {
  this.compiler = (node, file) => new Workflow(node as WorkflowNode, file)
}
