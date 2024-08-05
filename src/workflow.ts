import { unified, type Compiler } from 'unified'
import { u } from 'unist-builder'
import remarkStringify from 'remark-stringify'
import type { Root, Node, RootContent } from 'mdast'
import type { WorkflowNode } from './ast'
import type { FileWithData } from './parser'

/**
 * **Workflow** - A complete program defined in plain English using markdown.
 */
export class Workflow {
  title: string;
  description: string;
  inputs: ContextInput[];
  #ast: WorkflowNode;

  constructor(root: WorkflowNode, file: FileWithData) {
    // Slice up the nodes
    const phaseIdx = root.children.findIndex(n => n.type === 'flow-routine')
    const descAST = root.children.slice(0, phaseIdx).filter(n => n.type !== 'yaml')
    const phases = root.children.slice(phaseIdx)

    this.title = file.data.title as string
    this.description = toDescription(u('root', descAST as RootContent[]))
    this.inputs = file.data.matter?.inputs || []
    this.#ast = root
  }


}

function toDescription(node: Root): string {
  return unified()
    .use(remarkStringify)
    .stringify(node)
}

export type ContextType = 'string' | 'text' | 'image'

export interface ContextInput {
  name: string;
  description: string;
  type: ContextType;
}