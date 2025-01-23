import { unified } from 'unified'
import { VFile } from 'vfile'
import { VFileMessage } from 'vfile-message'
import { reporter } from 'vfile-reporter'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { validateWorkflow } from './validations'
import { visitor } from './visitor'
import {
  parseFrontmatter,
  removeComments,
  rewriteExpressions,
  visitActions,
  transformExpressions,
  transformIncludeFunctions,
  transformJsxFragments,
  validateAsyncFunctions,
  validateIdentifierBlacklist,
  validateNodeWhitelist,
  validateProgram,
} from './visitors'
import { Workflow } from '../workflow'

import type { Root } from 'mdast'
import type { Plugin, Processor, Transformer } from 'unified'
import type { Environment } from '../env'

const baseProcessor = unified()
  .use(remarkParse)
  .use(remarkStringify)
  .use(remarkMdx)

export function compile(
  src: string | VFile,
  env: Environment,
  onFail?: CompileFailCallback,
): VFile & { result: Workflow } {
  const file = looksLikeVfile(src) ? src : new VFile(src)
  try {
    return createCompiler(env).processSync(file)
  } catch(err) {
    if (typeof onFail === 'function' && err instanceof VFileMessage) {
      return onFail(err, file)
    } else {
      throw err
    }
  }
}

export function createCompiler(
  env: Environment
): Processor<Root, Root, Root, Root, Workflow> {
  // The main workflow transformer.
  // Walks the entire Markdown and ES tree validating and transforming nodes.
  const workflowVisitor: () => Transformer<Root, Root> = () => (tree, file) => {
    const promptProc = createPromptProcessor(env)
    const fragmentProc = createFragmentProcessor(env)

    visitor(tree, file)
      .on('md:enter', parseFrontmatter)
      .on('md:enter', removeComments)
      .on('md:enter', visitActions, env, { transform: true })
      .on('md:enter', transformExpressions)
      .on('es:enter', validateProgram)
      .on('es:enter', validateNodeWhitelist)
      .on('es:enter', validateIdentifierBlacklist)
      .on('es:enter', validateAsyncFunctions)
      .on('es:leave', transformIncludeFunctions, env, promptProc)
      .on('es:leave', transformJsxFragments, fragmentProc)
      .on('md:leave', rewriteExpressions)
      .visit()
  }

  // Workflow compiler - creates workflow and runs additional validations
  const workflowCompiler = function(this: Processor) {
    this.compiler = function (tree, file) {
      const workflow = new Workflow(tree as Root, env, file.basename)
      validateWorkflow(workflow, file)
      env.validate(workflow, file)
      return workflow
    }
  }

  return baseProcessor()
    .use(remarkFrontmatter, ['yaml'])
    .use(workflowVisitor)
    .use(workflowCompiler as Plugin<[], Root, Workflow>)
}

export function createPromptProcessor(
  env: Environment,
  includeStack: string[] = [],
): Processor<Root, Root, Root, Root, string> {
  // Prompt transformer.
  // Walks the tree of seperate prompt files, doing most of the same validation
  // as the main workflow transformer.
  const promptVisitor: (this: Processor) => Transformer<Root, Root> = function() {
    return (tree, file) => {
      const promptProc = createPromptProcessor(env, this.data('includeStack'))
      const fragmentProc = createFragmentProcessor(env, this.data('includeStack'))

      visitor(tree, file)
        .on('md:enter', removeComments)
        .on('md:enter', visitActions, env)
        .on('md:enter', transformExpressions)
        .on('es:enter', validateProgram)
        .on('es:enter', validateNodeWhitelist)
        .on('es:enter', validateIdentifierBlacklist)
        .on('es:enter', validateAsyncFunctions)
        .on('es:leave', transformIncludeFunctions, env, promptProc)
        .on('es:leave', transformJsxFragments, fragmentProc)
        .on('md:leave', rewriteExpressions)
        .visit()
    }
  }

  return baseProcessor()
    .data('includeStack', [...includeStack])
    .use(promptVisitor)
}

export function createFragmentProcessor(
  env: Environment,
  includeStack: string[] = [],
): Processor<Root, Root, Root, Root, string> {
  // Fragment transformer
  // For fragments we end up walking the sub-tree again. No need to re-validate
  // but we still apply transformations to inner fragments and inlcude statements.
  const fragmentVisitor: (this: Processor) => Transformer<Root, Root> = function() {
    return (tree, file) => {
      const promptProc = createPromptProcessor(env, this.data('includeStack'))
      const fragmentProc = createFragmentProcessor(env, this.data('includeStack'))

      visitor(tree, file)
        .on('md:enter', visitActions, env)
        .on('md:enter', transformExpressions)
        .on('es:leave', transformIncludeFunctions, env, promptProc)
        .on('es:leave', transformJsxFragments, fragmentProc)
        .on('md:leave', rewriteExpressions)
        .visit()
    }
  }
  return baseProcessor()
    .data('includeStack', [...includeStack])
    .use(fragmentVisitor)
}

export const reportFail: CompileFailCallback = (error, file) => {
  console.error(reporter([file], { defaultName: '[workflow]', verbose: true }))
  console.error(error)
  process.exit(1)
}

// Helpers

function looksLikeVfile(src: any): src is VFile {
  return typeof src === 'object' && 'message' in src && 'messages' in src
}

// Types

export type CompileFailCallback = (error: VFileMessage, file: VFile) => never
