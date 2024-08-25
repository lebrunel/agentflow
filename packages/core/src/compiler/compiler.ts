import { unified } from 'unified'
import { VFile } from 'vfile'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { workflowVisitor, workflowStructure, workflowCompiler } from './plugins'
import { Workflow } from '../workflow'

import type { Root } from 'mdast'
import type { Processor } from 'unified'
import type { Compatible } from 'vfile'
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

export interface CompileOptions {
  runtime?: any; // todo
}

type WorkflowFile = VFile & { result: Workflow }
