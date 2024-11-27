import { is } from 'unist-util-is'
import { toString } from 'mdast-util-to-string'
import { compile, compileSync, createScopedView, walkScopeTree } from './ast'

import type { Root } from 'mdast'
import type { Compatible, VFile } from 'vfile'
import type { CompileOptions, WorkflowScope, WorkflowWalker } from './ast'

export class Workflow {
  readonly ast: Root
  readonly meta: Record<string, any>
  readonly title: string
  readonly view: WorkflowScope

  constructor(ast: Root, file: VFile) {
    this.ast = ast
    this.view = createScopedView(ast.children)

    const yaml = ast.children[0].type === 'yaml'
      ? ast.children[0]
      : undefined

    const firstNode = ast.children[yaml ? 1 : 0]
    const titleNode = is(firstNode, 'heading')
      ? firstNode
      : undefined

    this.meta = yaml?.data || {}
    this.title = this.meta?.title
      || (titleNode && toString(titleNode))
      || file.basename
      || 'Untitled'
  }

  static async compile(source: Compatible, options: CompileOptions): Promise<Workflow> {
    const file = await compile(source, options)
    return file.result
  }

  static compileSync(source: Compatible, options: CompileOptions): Workflow {
    const file = compileSync(source, options)
    return file.result
  }

  walk<T extends Record<string, any>>(handlers: WorkflowWalker<T>): void {
    return walkScopeTree(this.view, handlers)
  }
}
