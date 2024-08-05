import { unified, type Compiler } from 'unified'
import { u } from 'unist-builder'
import remarkStringify from 'remark-stringify'
import type { Root, Node, RootContent } from 'mdast'
import type { FlowRootNode } from './ast'
import type { FileWithData } from './parser'

export class Flow {
  #description?: string;

  constructor(
    public title: string,
    public inputs: ContextInput[],
    private descAST: Root,
  ) {}
  
  get description(): string {
    this.#description ||= unified()
      .use(remarkStringify)
      .stringify(this.descAST)
    return this.#description
  }
}

export function compileFlow(root: FlowRootNode, file: FileWithData): Flow {
  const routineIdx = root.children.findIndex(n => n.type === 'flow-routine')
  const descAST = root.children.slice(0, routineIdx).filter(n => n.type !== 'yaml')
  const routines = root.children.slice(routineIdx)

  return new Flow(
    file.data.title as string,
    file.data.matter?.inputs || [],
    u('root', descAST as RootContent[])
  )
}

export type ContextType = 'string' | 'text' | 'image'

export interface ContextInput {
  name: string;
  description: string;
  type: ContextType;
}