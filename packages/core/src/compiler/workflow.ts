import { unified } from 'unified'
import { filter } from 'unist-util-filter'
import { select, selectAll } from 'unist-util-select'
import { toString } from 'mdast-util-to-string'
import { VFile } from 'vfile'
import remarkStringify from 'remark-stringify'
import type { Node, Root, Yaml } from 'mdast'

import { compileWorkflow } from './compiler'
import { Phase } from './phase'
import { ExecutionController } from '../runtime/controller'
import type { PhaseNode, WorkflowNode } from './ast'
import type { ContextType, ContextTypeMap, ContextValueMap } from '../runtime/context'
import type { Runtime } from '../runtime/runtime'

/**
 * **Workflow** - A complete program defined in plain English using markdown.
 */
export class Workflow {
  title: string
  readonly description: string = ''
  readonly inputs: WorkflowInput[]
  readonly meta: Record<string, any>
  readonly phases: Phase[] = []

  constructor(workflowNode: WorkflowNode, file?: VFile) {
    const root = select('root', workflowNode) as Root | undefined
    const yaml = select('yaml', root) as Yaml | undefined
    const phaseNodes = selectAll('phase', workflowNode) as PhaseNode[]

    this.meta = yaml?.data || {}
    this.inputs = this.meta?.inputs || []

    // get a title from either: meta, heading, file or fallback
    this.title = this.meta.title

    if (!this.title) {
      const firstNode = root
        ? (yaml ? root.children[1] : root.children[0])
        : phaseNodes[0].children[0]
      if (firstNode?.type === 'heading') {
        this.title = toString(firstNode)
      }
    }

    if (!this.title && root) {

    }

    this.title ||= file?.basename || 'Untitled'

    // stringify the description
    if (root) {
      const sanitizedRoot = filter(root, { cascade: false }, n => n.type !== 'yaml') as Root
      this.description = unified()
        .use(remarkStringify)
        .stringify(sanitizedRoot, file)
        .trim()
    }

    // create mutatable ContextTypeMap
    const context: ContextTypeMap = this.inputs.reduce((map, { name, type }) => {
      return Object.assign(map, { [name]: type })
    }, {})

    // collect phases
    for (const node of phaseNodes) {
      const phase = new Phase(node, context)
      this.phases.push(phase)
      Object.assign(context, phase.outputTypes)
    }
  }

  static parse(input: string | VFile, runtime: Runtime): Workflow {
    return compileWorkflow(input, runtime)
  }

  run(context: ContextValueMap, runtime: Runtime): ExecutionController {
    const controller = new ExecutionController(this, context, runtime)
    queueMicrotask(() => controller.runAll())
    return controller
  }

  validate(runtime: Runtime): true {
    // todo - implement validate
    return true
  }
}

// Types

export interface WorkflowInput {
  name: string;
  description?: string;
  type: ContextType;
}
