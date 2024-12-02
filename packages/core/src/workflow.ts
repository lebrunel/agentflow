import { is } from 'unist-util-is'
import { toString } from 'mdast-util-to-string'
import { compile, compileSync, createScopedView, validateWorkflow } from './ast'
import { ExecutionController } from './exec'

import type { Root } from 'mdast'
import type { Compatible, VFile } from 'vfile'
import type { WorkflowScope } from './ast'
import type { ContextValueMap } from './context'
import type { Environment } from './env'

export class Workflow {
  readonly meta: WorkflowMetadata
  readonly title: string
  readonly view: WorkflowScope

  constructor(readonly ast: Root, readonly env: Environment, basename?: string) {
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
      || basename
      || 'Untitled'
  }

  static async compile(source: Compatible, env: Environment): Promise<Workflow> {
    const file = await compile(source, env)
    return file.result
  }

  static compileSync(source: Compatible, env: Environment): Workflow {
    const file = compileSync(source, env)
    return file.result
  }

  createExecution(input?: InputResolver | ContextValueMap): ExecutionController {
    if (typeof input === 'function') {
      input = input(this.meta)
    } else if (typeof input === 'undefined') {
      input = this.env.resolveInput(this)
    }

    return new ExecutionController(this, input)
  }

}

// Types

export type WorkflowMetadata = Record<string, any>

export type InputResolver = (meta: WorkflowMetadata) => ContextValueMap

export type WorkflowValidator = (workflow: Workflow, file: VFile) => void
