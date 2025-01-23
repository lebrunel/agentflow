import { is } from 'unist-util-is'
import { toString } from 'mdast-util-to-string'
import { compile, createScopedView } from './ast'
import { ExecutionController } from './exec'

import type { Root } from 'mdast'
import type { VFile } from 'vfile'
import type { WorkflowScope } from './ast'
import type { ContextValueMap } from './context'
import type { Environment } from './env'

export class Workflow {
  readonly ast: Root
  readonly env: Environment
  readonly meta: WorkflowMetadata
  readonly title: string
  readonly view: WorkflowScope

  constructor(root: Root, env: Environment, basename?: string) {
    this.ast = root
    this.env = env
    this.view = createScopedView(root.children)

    const yaml = root.children[0].type === 'yaml'
      ? root.children[0]
      : undefined

    const firstNode = root.children[yaml ? 1 : 0]
    const titleNode = is(firstNode, 'heading')
      ? firstNode
      : undefined

    this.meta = yaml?.data || {}
    this.title = this.meta?.title
      || (titleNode && toString(titleNode))
      || basename
      || 'Untitled'
  }

  static compile(src: string | VFile, env: Environment): Workflow {
    const file = compile(src, env)
    return file.result
  }

  static compileSync(src: string | VFile, env: Environment): Workflow {
    const file = compile(src, env)
    return file.result
  }

  createExecution(input?: ContextValueMap): ExecutionController {
    return new ExecutionController(this, input)
  }

}

// Types

export type WorkflowMetadata = Record<string, any>
