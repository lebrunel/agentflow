import { is } from 'unist-util-is'
import { walkScopeTree } from '../ast'
import { getExpressionDependencies } from '../exec'

import type { Node } from 'mdast'
import type { Program, Property } from 'estree-jsx'
import type { VFile } from 'vfile'
import type { ExpressionNode } from './types'
import type { ContextKey } from '../context'
import type { Workflow } from '../workflow'

export function validateWorkflow(
  workflow: Workflow,
  file: VFile,
) {
  walkScopeTree(workflow.view, {
    onScope(scope) {
      const contextKeys = new Set<ContextKey>()

      // root scope
      if (typeof scope.parentNode === 'undefined') {
        if (workflow.ast.children[0].type === 'yaml') {
          const yaml = workflow.ast.children[0]
          const initialKeys = [
            ...Object.keys(workflow.meta?.data || {}),
            ...Object.keys(workflow.meta?.input || {}),
          ]
          for (const key of initialKeys) {
            validateUniqueness(key, contextKeys, { node: yaml, file })
            contextKeys.add(key)
          }
        }
      // child scope
      } else {
        contextKeys.add('$')
        contextKeys.add(`$${scope.parentNode.attributes.as}`)
        const provideAttr = scope.parentNode.attributes.provide

        if (is(provideAttr, 'expression')) {
          for (const key of getObjectKeysFromExpression(provideAttr as ExpressionNode)) {
            validateUniqueness(key, contextKeys, { node: scope.parentNode!, file })
            contextKeys.add(key)
          }
        }
      }

      return { contextKeys }
    },

    onPhase(phase, context) {
      for (const step of phase.steps) {
        for (const node of step.expressions.filter(n => !!n.data?.estree)) {
          // Validate flow/text expression deps
          for (const key of getExpressionDependencies(node)) {
            validateDependency(key, context.contextKeys, { node, file })
          }
        }

        if (step.action) {
          const contextKey: ContextKey = step.action.attributes.as

          // Validate Attribute Expression deps
          for (const attr of Object.values(step.action.attributes)) {
            if (is(attr, 'expression')) {
              const expr = attr as ExpressionNode
              for (const key of getExpressionDependencies(expr)) {
                validateDependency(key, context.contextKeys, {
                  node: expr,
                  file: file,
                  namespace: contextKey,
                })
              }
            }
          }

          // Add action contextKey to set
          validateUniqueness(contextKey, context.contextKeys, {
            node: step.action,
            file,
          })

          context.contextKeys.add(contextKey)
        }
      }
    },
  })
}

const JS_GLOBALS = [
  // global identifiers
  'undefined',
  'globalThis',
  'NaN',
  'Infinity',
  // global constructors
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Date',
  'Math',
  'JSON',
  'RegExp',
  'Error',
  // Agentflow builtins
  'dedent',
  'include',
  '_fragment',
]

export function validateDependency(
  key: ContextKey,
  contextKeys: Set<ContextKey>,
  { node, file, namespace }: {
    node: Node,
    file: VFile,
    namespace?: string,
  }
) {
  const helperNames = !!namespace ? ['$', `$${namespace}`] : ['$']

  if (
    !contextKeys.has(key) &&
    !helperNames.includes(key) &&
    !JS_GLOBALS.includes(key)
  ) {
    file.fail(
      `Unknown context "${key}". This Action depends on context that hasn't been defined earlier in the workflow.`,
      node,
      'workflow-parse:undefined-context'
    )
  }
}

export function validateUniqueness(
  key: ContextKey,
  contextKeys: Set<ContextKey>,
  { node, file }: {
    node: Node,
    file: VFile,
  }
) {
  if (contextKeys.has(key)) {
    const message = `Duplicate context name "${key}". Context keys must be unique within the same scope.`
    file.fail(message, node, 'workflow-parse:duplicate-context')
  }
}

function getObjectKeysFromExpression(attr: ExpressionNode): ContextKey[] {
  const tree = attr?.data?.estree as Program
  const last = tree.body[tree.body.length - 1]
  if (last.type === 'ExpressionStatement' && last.expression.type === 'ObjectExpression') {
    return last.expression.properties
      .filter((prop): prop is Property => prop.type === 'Property')
      .map(prop => {
        if (prop.key.type === 'Identifier') {
          return prop.key.name
        } else if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') {
          return prop.key.value
        }
        return null
      })
      .filter((name): name is string => typeof name === 'string')
  }
  return []
}
