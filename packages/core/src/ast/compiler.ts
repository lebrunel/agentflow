import { unified } from 'unified'
import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { visit, CONTINUE, SKIP } from 'unist-util-visit'
import { z } from 'zod'
import { camelCase, kebabCase } from 'change-case'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import yaml from 'yaml'
import { Workflow } from '../workflow'
import { validateWorkflow, validateEstree } from './validations'

import type { Program } from 'estree-jsx'
import type { Root, Yaml } from 'mdast'
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import type { Plugin, Processor, Transformer } from 'unified'
import type { Compatible, VFile } from 'vfile'
import type { ExpressionNodeType } from './types'
import type { Environment } from '../env'

/**
 * Compiles a workflow asynchronously. This function processes the workflow,
 * validates its structure, and returns a Workflow object.
 */
export async function compile(
  file: Compatible,
  env: Environment,
): Promise<WorkflowFile> {
  return createCompiler(env).process(file)
}

/**
 * Compiles a workflow synchronously. This function processes the workflow,
 * validates its structure, and returns a Workflow object.
 */
export function compileSync(
  file: Compatible,
  env: Environment,
): WorkflowFile {
  return createCompiler(env).processSync(file)
}

export function createCompiler(
  env: Environment
): Processor<Root, Root, Root, Root, Workflow> {

  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMdx)
    .use(agentflowFromMdx, env)
    .use(agentflowCompile, env)
}

function agentflowFromMdx(env: Environment): Transformer<Root, Root> {
  return (tree, file) => {
    visit(tree, (node, i, parent) => {
      // root node, just continue
      if (typeof i === 'undefined') return CONTINUE

      // yaml node, parse and validate frontmatter
      if (is(node, 'yaml')) {
        node.data = parseFrontMatter(node, file)
        return SKIP
      }

      // blockquotes, treat as comments, remove and and ignore
      if (is(node, 'blockquote')) {
        parent!.children.splice(i, 1)
        return [SKIP, i]
      }

      // Actions
      if (is(node, 'mdxJsxFlowElement')) {
        const { children, position } = node
        const name = kebabCase(node.name || '')
        const attr = parseAttributes(node, file)

        try {
          const action = env.useAction(name)
          const attributes = action.parse(attr)

          parent!.children[i] = u('action', {
            name,
            children,
            attributes,
            position,
          })

          return CONTINUE

        } catch(e) {
          if (e instanceof z.ZodError) {
            for (const issue of e.issues) {
              file.fail(
                `Invalid action attributes at /${issue.path.join('.')}. ${issue.message}`,
                node,
                'workflow-parse:invalid-action-attributes'
              )
            }
          } else {
            file.fail(
              `Unknown action '${name || 'unnamed'}'. Actions must be registered.`,
              node,
              'workflow-parse:unknown-action'
            )
          }
        }
      }

      if (is(node, 'mdxJsxTextElement')) {
        file.fail('Action must be a block-level element', node, 'workflow-parse:action-inline')
        return SKIP
      }

      // Expressions
      if (is(node, 'mdxFlowExpression') || is(node, 'mdxTextExpression')) {
        validateEstree(node.data!.estree as Program, file)

        parent!.children[i] = u('expression', {
          expressionType: (is(node, 'mdxFlowExpression') ? 'flow' : 'text') as ExpressionNodeType,
          data: node.data,
          value: node.value,
          position: node.position,
        })

        return SKIP
      }
    })
  }
}

const agentflowCompile: Plugin<[Environment], Root, Workflow> = function (
  this: Processor,
  env: Environment,
) {
  this.compiler = function (tree, file) {
    const workflow = new Workflow(tree as Root, env, file.basename)
    validateWorkflow(workflow, file)
    env.validate(workflow, file)
    return workflow
  }
}

function parseFrontMatter(node: Yaml, file: VFile): any {
  try {
    return yaml.parse(node.value)
  } catch (e: unknown) {
    file.fail(e as Error, node, 'workflow-parse:yaml-error')
  }
}

function parseAttributes(
  node: MdxJsxFlowElement | MdxJsxTextElement,
  file: VFile,
): Record<string, any> {
  const attributes: Record<string, any> = {}

  for (const attr of node.attributes) {
    if (attr.type === 'mdxJsxAttribute') {
      const propName = camelCase(attr.name)

      if (is(attr.value, 'mdxJsxAttributeValueExpression')) {
        validateEstree(attr.value.data?.estree as Program, file)

        attributes[propName] = u('expression', {
          expressionType: 'attribute',
          data: attr.value.data,
          value: attr.value.value,
          position: node.position,
        })
      } else {
        attributes[propName] = attr.value
      }
    } else {
      file.fail(
        'Unsupported attribute syntax in Action. Use key-value pairs only.',
        attr,
        'workflow-parse:unsupported-attribute-syntax'
      )
    }
  }

  return attributes
}

// Type

type WorkflowFile = VFile & {
  result: Workflow,
}
