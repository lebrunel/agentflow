import { unified } from 'unified'
import { filter } from 'unist-util-filter'
import { select, selectAll } from 'unist-util-select'
import { toString } from 'mdast-util-to-string'
import { VFile } from 'vfile'
import remarkStringify from 'remark-stringify'
import type { Root, Yaml } from 'mdast'

import { compileWorkflow } from './compiler'
import { Phase } from './phase'
import { ExecutionController } from '../runtime/controller'
import type { PhaseNode, WorkflowNode } from './ast'
import type { ContextTypeMap, ContextValueMap } from '../runtime/context'
import type { Runtime } from '../runtime/runtime'

/**
 * **Workflow** - A complete program defined in plain English using markdown.
 */
export class Workflow {
  title: string
  readonly description: string = ''
  readonly inputs: WorkflowInputs
  readonly meta: Record<string, any>
  readonly phases: Phase[] = []

  constructor(workflowNode: WorkflowNode, file?: VFile) {
    const root = select('root', workflowNode) as Root | undefined
    const yaml = select('yaml', root) as Yaml | undefined
    const phaseNodes = selectAll('phase', workflowNode) as PhaseNode[]

    this.meta = yaml?.data || {}
    // TODO - valid input schema
    this.inputs = this.meta?.inputs || {}

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
    const context: ContextTypeMap =
      Object.entries(this.inputs).reduce((map, [name, { type }]) => {
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

export interface WorkflowInputs {
  [name: string]: InputSchema;
}

export type InputSchema =
  | TextInputSchema
  | SelectInputSchema
  | FileInputSchema
  | ArrayInputSchema

export type InputType =
  | 'text'
  | 'select'
  | 'file'
  | 'array'

interface BaseInputSchema {
  type: InputType;
  message?: string;
}

export interface TextInputSchema extends BaseInputSchema {
  type: 'text';
  multiline?: boolean;
}

export interface SelectInputSchema extends BaseInputSchema {
  type: 'select';
  choices: Array<string | {name: string; value: string}>;
}

export interface FileInputSchema extends BaseInputSchema {
  type: 'file';
  fileType: 'text' | 'image';
}

export interface ArrayInputSchema extends BaseInputSchema {
  type: 'array'
}