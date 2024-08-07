import { unified, type Processor } from 'unified'
import { select, selectAll } from 'unist-util-select'
import { toString } from 'mdast-util-to-string'
import { parse } from 'yaml'
import remarkStringify from 'remark-stringify'
import type { Root, Yaml } from 'mdast'
import type { WorkflowNode } from './ast'
import { parseProcessor } from './parser'
import { VFile } from 'vfile'
import { filter } from 'unist-util-filter'

/**
 * **Workflow** - A complete program defined in plain English using markdown.
 */
export class Workflow {
  title: string;
  description: string;
  inputs: ContextInput[];
  meta: Record<string, unknown>;
  phases: any[];

  constructor(phases: any[], opts: WorkflowInitOpts) {
    this.title = opts.title
    this.description = opts.description
    this.inputs = opts.inputs
    this.meta = opts.meta
    this.phases = phases
  }

  static parse(input: string | VFile): Workflow {
    const file = parseProcessor()
      .use<[], WorkflowNode, Workflow>(compiler)
      .processSync(input)
    return file.result
  }
}

export function compileWorkflow(ast: WorkflowNode, file: VFile): Workflow {
  const root = select('root', ast) as Root | undefined
  const yaml = select('yaml', root) as Yaml | undefined
  const meta = yaml ? parse(yaml.value) : {}
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

  // todo - compile into phases
  const phases = selectAll('phase', ast)

  return new Workflow(phases, { title, description, inputs, meta })
}

// Types

export interface WorkflowInitOpts {
  title: string;
  description: string;
  inputs: ContextInput[];
  meta: Record<string, unknown>;
}

// Helpers

function compiler(this: Processor) {
  this.compiler = (node, file) => compileWorkflow(node as WorkflowNode, file)
}



export type ContextType = 'string' | 'text' | 'image'

export interface ContextInput {
  name: string;
  description: string;
  type: ContextType;
}