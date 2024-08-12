import { unified } from 'unified'
import { filter } from 'unist-util-filter'
import { select, selectAll } from 'unist-util-select'
import { toString } from 'mdast-util-to-string'
import { VFile } from 'vfile'
import remarkStringify from 'remark-stringify'
import { Phase } from './phase'
import { useProcessor } from './processor'
import { ExecutionController } from './execution/controller'

import type { Root, Yaml } from 'mdast'
import type { PhaseNode, WorkflowNode } from './ast'
import type { ContextType, ContextTypeMap, ContextValueMap } from './context'

/**
 * **Workflow** - A complete program defined in plain English using markdown.
 */
export class Workflow {
  title: string;
  readonly description: string;
  readonly inputs: WorkflowInput[];
  readonly meta: Record<string, unknown>;
  readonly phases: Phase[] = [];

  constructor(opts: WorkflowInitOpts) {
    this.title = opts.title
    this.description = opts.description
    this.inputs = opts.inputs
    this.meta = opts.meta

    this.mapPhases(opts.phases)
  }

  static compile(ast: WorkflowNode, file?: VFile): Workflow {
    return new Workflow(createWorkflowInitOpts(ast, file))
  }

  static parse(input: string | VFile): Workflow {
    const file = useProcessor()
      .processSync(input)
    return file.result
  }

  run(context: ContextValueMap): ExecutionController {
    const controller = new ExecutionController(this, context)
    queueMicrotask(() => controller.runAll())
    return controller
  }

  private mapPhases(phaseNodes: PhaseNode[]) {
    // create mutatable ContextTypeMap
    const context: ContextTypeMap = this.inputs.reduce((map, { name, type }) => {
      return Object.assign(map, { [name]: type })
    }, {})

    // build phases
    for (const node of phaseNodes) {
      const phase = new Phase(node, context)
      this.phases.push(phase)
      Object.assign(context, phase.outputTypes)
    }
  }
}

// Types

export interface WorkflowInitOpts {
  title: string;
  description: string;
  inputs: WorkflowInput[];
  meta: Record<string, unknown>;
  phases: PhaseNode[];
}

export interface WorkflowInput {
  name: string;
  description?: string;
  type: ContextType;
}

// Helpers

function createWorkflowInitOpts(ast: WorkflowNode, file?: VFile): WorkflowInitOpts {
  const root = select('root', ast) as Root | undefined
  const yaml = select('yaml', root) as Yaml | undefined
  const meta: any = (yaml?.data || {})
  const inputs = meta?.inputs || []

  // get a title from either: meta, heading, file or fallbacl
  let title: string | undefined = meta?.title
  
  if (!title && root) {
    const firstIdx = yaml ? 1 : 0
    const firstNode = root.children[firstIdx]
    if (firstNode?.type === 'heading') {
      title = toString(firstNode)
    }
  }
  
  title ||= file?.basename || 'Untitled'

  // stringify the description
  let description: string = ''
  if (root) {
    const sanitizedRoot = filter(root, { cascade: false }, n => n.type !== 'yaml') as Root
    description = unified()
      .use(remarkStringify)
      .stringify(sanitizedRoot, file)
      .trim()
  }

  // collect phases
  const phases = selectAll('phase', ast) as PhaseNode[]
  
  return { title, description, inputs, meta, phases }
}
