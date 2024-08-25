import { unified, type Plugin, type Processor } from 'unified'
import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { visit, CONTINUE, SKIP } from 'unist-util-visit'
import { selectAll } from 'unist-util-select'
import { toString } from 'mdast-util-to-string'
import { VFile, type Compatible} from 'vfile'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import type { Program } from 'estree-jsx'
import type { Node, Root, RootContent } from 'mdast'

import { WorkflowInputSchema } from './inputs'
import { Workflow, type WorkflowPhase, type WorkflowAction } from './workflow'
import { evalDependencies } from '../runtime/eval'
import type { ContextTypeMap } from './context'
import type { MdxJsxExpressionAttributeData } from 'mdast-util-mdx-jsx'
import remarkStringify from 'remark-stringify'

/**
 * Compiles a workflow asynchronously. This function processes the workflow,
 * validates its structure, and returns a Workflow object.
 */
export async function compile(file: Compatible, options: CompileOptions = {}): Promise<WorkflowFile> {
  return createProcessor(options).process(file)
}

/**
 * Compiles a workflow synchronously. This function processes the workflow,
 * validates its structure, and returns a Workflow object.
 */
export function compileSync(file: Compatible, options: CompileOptions = {}): WorkflowFile {
  return createProcessor(options).processSync(file)
}

/**
 * Creates a unified processor for parsing and processing workflow documents.
 * This function sets up the necessary plugins and configurations to handle
 * the specific syntax and structure of workflows.
 */
export function createProcessor(_options: CompileOptions = {}): Processor<Root, Root, WorkflowNode, WorkflowNode, Workflow> {
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

const workflowVisitor: Plugin<[], Root, Root> = function() {
  return (tree, file) => {
    visit(tree, (node, i, parent) => {
      if (typeof i === 'undefined') return

      if (is(node, 'yaml')) {
        try {
          node.data = parseYaml(node.value)
          WorkflowInputSchema.parse((node.data as any).inputs || {})
        } catch(e: any) {
          if (e instanceof z.ZodError) {
            for (const issue of e.issues) {
              file.fail(
                `Invalid input schema at \`${issue.path.join('.')}\`. ${issue.message}`,
                node,
                'workflow-parse:invalid-input-schema'
              )
            }
          } else {
            file.fail(e as Error, node, 'workflow-parse:yaml-error')
          }
        }
        return SKIP
      }

      if (is(node, 'mdxJsxFlowElement')) {
        // todo - validate action name
        //if (!allowedActions.includes(node.name)) {
        //  file.fail('', node, 'workflow-parse:error')
        //  return SKIP
        //}

        const { name, children, position } = node
        const attributes: Record<string, any> = {}

        for (const attr of node.attributes) {
          if (attr.type === 'mdxJsxAttribute') {
            const value = is(attr.value, 'mdxJsxAttributeValueExpression')
              ? {
                  type: 'expression',
                  value: attr.value.value,
                  position: attr.value.position
                } as ExpressionNode
              : attr.value
            attributes[attr.name] = value
          } else {
            file.message(
              'Unsupported attribute syntax in Action. Use key-value pairs only.',
              attr,
              'workflow-parse:unsupported-attribute-syntax'
            )
          }
        }

        // todo - validate attributes against action schema

        parent!.children[i] = u('action', { name: name!, children, attributes, position })
        return CONTINUE
      }

      if (is(node, 'mdxJsxTextElement')) {
        file.fail('Action must be a block-level element', node, 'workflow-parse:action-inline')
        return SKIP
      }

      if (is(node, 'mdxFlowExpression')) {
        // todo - validate expression statement
        parent!.children[i] = u('paragraph', [
          u('expression', {
            value: node.value,
            position: node.position,
            data: node.data,
          })
        ])
        return SKIP
      }

      if (is(node, 'mdxTextExpression')) {
        // todo - validate expression statement
        parent!.children[i] = u('expression', {
          value: node.value,
          position: node.position,
          data: node.data,
        })
        return SKIP
      }
    })
  }
}

const workflowStructure: Plugin<[], Root, WorkflowNode> = function() {
  return (tree, _file) => {
    const workflowRoot: Root = u('root', [])
    const workflowNode: WorkflowNode = u('workflow', [workflowRoot])
    const nodes = tree.children
    let cursor = 0

    function processNodes(block: RootContent[]) {
      const isFirst = !workflowNode.children.some(n => is(n, 'phase'))
      const hasAction = block.some(n => is(n, 'action'))

      if (isFirst && !hasAction) {
        workflowRoot.children.push(...block)
      } else {
        workflowNode.children.push(u('phase', block))
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]

      if (i == 0 && is(node, 'yaml')) {
        workflowRoot.children.push(node)
        cursor = 1
      }

      if (is(node, 'thematicBreak')) {
        if (i > cursor) processNodes(nodes.slice(cursor, i))
        cursor = i + 1
      }
    }

    // process last section
    if (cursor < nodes.length) processNodes(nodes.slice(cursor))

    return workflowNode
  }
}

const workflowCompiler: Plugin<[], WorkflowNode, Workflow> = function(this: Processor) {
  this.compiler = function(node, file) {
    const workflowNode = node as WorkflowNode
    const workflowRoot = workflowNode.children[0] as Root
    const yaml = workflowRoot.children.find(n => is(n, 'yaml'))
    const meta = (yaml?.data || {}) as Record<string, any>

    const titleIdx = yaml ? 1 : 0
    const firstNode = workflowRoot.children.length > titleIdx
      ? workflowRoot.children[titleIdx]
      : workflowNode.children[1].children[0]
    const titleNode = is(firstNode, 'heading')
      ? firstNode
      : undefined

    // Get the title, with fallback
    const title = meta?.title
      || (titleNode && toString(titleNode))
      || file?.basename
      || 'Untitled'

    const descriptionNodes = workflowRoot.children.slice(titleIdx)
    const inputSchema: WorkflowInputSchema = meta?.inputs || {}

    // Create mutatable ContextTypeMap
    const contextTypes: ContextTypeMap =
      Object.entries(inputSchema).reduce((map, [name, { type }]) => {
        return Object.assign(map, { [name]: type })
      }, {})

    // Collect phases
    const phases: WorkflowPhase[] = []
    for (const node of selectAll('phase', workflowNode)) {
      const phase = workflowPhase(node as PhaseNode, contextTypes, file)
      phases.push(phase)
      Object.assign(contextTypes, phase.outputTypes)
    }

    return new Workflow(
      title,
      descriptionNodes,
      inputSchema,
      phases,
      meta,
    )
  }
}

function workflowPhase(phaseNode: PhaseNode, contextTypes: ContextTypeMap, file: VFile): WorkflowPhase {
  const actions: WorkflowAction[] = []
  const dependencies = new Set<string>()
  const inputTypes = { ...contextTypes }
  const outputTypes: ContextTypeMap = {}

  function validateDependency(node: ExpressionNode, contextName: string) {
    if (!inputTypes[contextName] && !outputTypes[contextName]) {
      file.fail(
        `Unknown context "${contextName}". This Action depends on a context that hasn't been defined earlier in the workflow.`,
        node,
        'workflow-parse:undefined-context'
      )
    }
  }

  function validateUniqueness(node: ActionNode, contextName: string) {
    if (contextName in inputTypes) {
      file.fail(
        `Duplicate context name "${contextName}". Each Action must have a unique name within the workflow.`,
        node,
        'workflow-parse:duplicate-context'
      )
    }
  }

  visit(phaseNode, node => {
    if (is(node, 'action')) {
      const contextName = node.attributes.name
      validateUniqueness(node, contextName)
      outputTypes[contextName] = 'text' // todo - this should come from the runtime action
      return CONTINUE
    }

    if (is(node, 'expression') && node.data?.estree) {
      const program = node.data!.estree! as Program
      for (const name of evalDependencies(program)) {
        validateDependency(node, name)
        dependencies.add(name)
      }
    }
  })

  // iterate ast children to build action pointers
  let cursor = 0
  for (let i = 0; i < phaseNode.children.length; i++) {
    const node = phaseNode.children[i]
    if (is(node, 'action')) {
      const action = workflowAction(node, phaseNode.children.slice(cursor, i), file)
      actions.push(action)
      cursor = i + 1
    }
  }

  // caputure remaining nodes
  const trailingNodes = phaseNode.children.slice(cursor)

  return {
    actions,
    dependencies,
    inputTypes,
    outputTypes,
    trailingNodes,
  }
}

function workflowAction(actionNode: ActionNode, contentNodes: RootContent[], _file: VFile): WorkflowAction {
  return {
    name: actionNode.name,
    contextName: actionNode.attributes.name,
    contentNodes,
    props: actionNode.attributes
  }
}

// Types

export interface CompileOptions {
  runtime?: any; // to correct type
}

export interface WorkflowNode extends Node {
  type: 'workflow';
  children: Array<Root | PhaseNode>;
}

export interface PhaseNode extends Node {
  type: 'phase';
  children: Array<RootContent>;
}

export interface ActionNode extends Node {
  type: 'action';
  name: string;
  children: Array<RootContent>;
  attributes: Record<string, any>;
}

export interface ExpressionNode extends Node {
  type: 'expression';
  data?: MdxJsxExpressionAttributeData;
}

export type WorkflowFile = VFile & { result: Workflow }

declare module 'mdast' {
  interface PhrasingContentMap {
    conextNode: ExpressionNode;
  }

  interface BlockContentMap {
    actionNode: ActionNode;
  }

  interface RootContentMap {
    actionNode: ActionNode;
  }
}

declare module 'unified' {
  interface CompileResultMap {
    flow: Workflow;
  }
}
