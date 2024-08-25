import { unified } from 'unified'
import { u } from 'unist-builder'
import { VFile, type Compatible} from 'vfile'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import remarkStringify from 'remark-stringify'
import type { Root, RootContent } from 'mdast'
import type { Processor } from 'unified'

import { Workflow } from '../workflow/workflow'
import { workflowVisitor, workflowStructure, workflowCompiler } from './plugins'
import type { WorkflowNode } from './ast'

/**
 * Compiles a workflow asynchronously. This function processes the workflow,
 * validates its structure, and returns a Workflow object.
 */
export async function compile(
  file: Compatible,
  options: CompileOptions = {},
): Promise<WorkflowFile> {
  return createProcessor(options).process(file)
}

/**
 * Compiles a workflow synchronously. This function processes the workflow,
 * validates its structure, and returns a Workflow object.
 */
export function compileSync(
  file: Compatible,
  options: CompileOptions = {},
): WorkflowFile {
  return createProcessor(options).processSync(file)
}

/**
 * Creates a unified processor for parsing and processing workflow documents.
 * This function sets up the necessary plugins and configurations to handle
 * the specific syntax and structure of workflows.
 */
export function createProcessor(
  _options: CompileOptions = {}
): Processor<Root, Root, WorkflowNode, WorkflowNode, Workflow> {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMdx)
    .use(workflowVisitor)
    .use(workflowStructure)
    .use(workflowCompiler)
}

export function stringify(root: Root): string {
  return unified()
    .use(remarkStringify)
    .stringify(root)
    .trim()
}

export function stringifyContent(nodes: RootContent[]): string {
  return stringify(u('root', nodes))
}

export interface CompileOptions {
  runtime?: any; // todo
}

export type WorkflowFile = VFile & { result: Workflow }
