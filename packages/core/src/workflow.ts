import { unified, type Processor } from 'unified'
import { filter } from 'unist-util-filter'
import { select, selectAll } from 'unist-util-select'
import { toString } from 'mdast-util-to-string'
import { VFile } from 'vfile'
import remarkStringify from 'remark-stringify'
import type { Root, Yaml } from 'mdast'
import type { PhaseNode, WorkflowNode } from './ast'
import type { ContextInput, ContextMap, ContextMap2 } from './context'
import { parseProcessor } from './parser'
import { Phase } from './phase'
//import { ExecutionRunner } from './execution/runner'

/**
 * **Workflow** - A complete program defined in plain English using markdown.
 */
export class Workflow {
  title: string;
  readonly description: string;
  readonly inputs: ContextInput[];
  readonly meta: Record<string, unknown>;
  readonly phases: Phase[] = [];

  constructor(opts: WorkflowInitOpts) {
    this.title = opts.title
    this.description = opts.description
    this.inputs = opts.inputs
    this.meta = opts.meta

    // init mutatable contextMap
    const context = this.createInputMap()
    // build phases
    for (const phaseNode of opts.phases) {
      const phase = new Phase(phaseNode, context)
      for (const [name, type] of phase.outputs) {
        context.set(name, type)
      }
      this.phases.push(phase)
    }
  }

  static compile(ast: WorkflowNode, file?: VFile): Workflow {
    return new Workflow(createWorkflowInitOpts(ast, file))
  }

  static parse(input: string | VFile): Workflow {
    const file = parseProcessor()
      .use<[], WorkflowNode, Workflow>(compiler)
      .processSync(input)
    return file.result
  }

  private createInputMap(): ContextMap2 {
    return new Map(this.inputs.map(({ name, type }) => [name, type]))
  }

  //run(context: ContextMap): ExecutionRunner {
  //  const runner = new ExecutionRunner(this, context)
  //  queueMicrotask(() => runner.run())
  //  return runner
  //}
}

// Types

export interface WorkflowInitOpts {
  title: string;
  description: string;
  inputs: ContextInput[];
  meta: Record<string, unknown>;
  phases: PhaseNode[];
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

function compiler(this: Processor) {
  this.compiler = (node, file) => Workflow.compile(node as WorkflowNode, file)
}
