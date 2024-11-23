import { is } from 'unist-util-is'
import { walk } from 'estree-walker'

import type { Node } from 'mdast'
import type { VFile } from 'vfile'
import type { ExpressionNode } from './types'
import type { ContextKey } from '../context'
import type { Workflow } from '../workflow'
import type {
  Identifier,
  Node as EsNode,
  Program,
  Property,
  Pattern,
  ObjectPattern,
  ArrayPattern
} from 'estree-jsx'

const AST_WHITELIST: Node['type'][] = [
  'Program',
  'ExpressionStatement',
  'ArrayExpression',
  'ArrowFunctionExpression',
  'AssignmentExpression',
  'BinaryExpression',
  'CallExpression',
  'ChainExpression',
  'ConditionalExpression',
  'Identifier',
  'Literal',
  'LogicalExpression',
  'MemberExpression',
  'ObjectExpression',
  'Property',
  'SpreadElement',
  'TemplateLiteral',
  'TemplateElement',
  'UnaryExpression',
  'UpdateExpression',
  'VariableDeclaration',
  'VariableDeclarator',
  'BlockStatement',
  'ReturnStatement',
  'FunctionExpression',
]

const IDENTIFIER_BLACKLIST: string[] = [
  'eval',
  'Function',
  'window',
  'document',
  'global',
  'globalThis',
  'process',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'clearImmediate',
  'Promise',
  'Proxy',
  'Reflect',
  'constructor',
  '__proto__',
  'prototype',
]

export function validateWorkflow(workflow: Workflow, file: VFile) {
  workflow.walk({
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
        const provideAttr = scope.parentNode.attributes.provide
        if (provideAttr) {
          for (const key of getObjectKeysFromExpression(provideAttr)) {
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
          for (const key of getDependenciesFromExpression(node.data!.estree!)) {
            validateDependency(key, context.contextKeys, { node, file })
          }
        }

        if (step.action) {
          const contextKey: ContextKey = step.action.attributes.as

          // Validate Attribute Expression deps
          for (const attr of Object.values(step.action.attributes)) {
            if (is(attr, 'expression')) {
              const expr = attr as ExpressionNode
              const program = expr.data!.estree! as Program
              for (const key of getDependenciesFromExpression(program)) {
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

    // commenting this out as I don't think loops and nodes should require this
    // maybe this is justa  runtime error
    //onAction(action) {
    //  if (!action.inputNodes.length) {
    //    file.fail(
    //      'Action has no input context. Actions must have preceding input context.',
    //      action.node,
    //      'workflow-parse:missing-input-context'
    //    )
    //  }
    //}
  })
}

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
    !helperNames.includes(key)
  ) {
    file.fail(
      `Unknown context "${key}". This Action depends on a context that hasn't been defined earlier in the workflow.`,
      node,
      'workflow-parse:undefined-context'
    )
  }
}

export function validateEstree(program: Program, file: VFile) {
  for (const stmt of program.body) {
    if (stmt.type !== 'ExpressionStatement') {
      file.fail(
        'Invalid workflow expression. Only simple expression statements are supported.',
        stmt,
        'workflow-parse:invalid-expression'
      )
    }
  }

  walk(program, {
    enter(node) {
      if (!AST_WHITELIST.includes(node.type)) {
        file.fail(
          `Unsupported JavaScript syntax '${node.type}' in workflow expression.`,
          node,
          'workflow-parse:unsupported-syntax'
        )
      }

      if (node.type === 'Identifier' && IDENTIFIER_BLACKLIST.includes(node.name)) {
        file.fail(
          `Restricted identifier '${node.name}' used in workflow expression.`,
          node,
          'workflow-parse:restricted-identifier'
        )
      }

      if (
        (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression')
        && node.async
      ) {
        file.fail(
          'Async functions are not supported in workflow expressions.',
          node,
          'workflow-parse:async-function-not-allowed'
        )
      }
    }
  })
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

function getDependenciesFromExpression(tree: Program): string[] {
  const globals = new Set<string>()
  const scopeChain: Array<Set<string>> = [new Set()]

  function addToScope(name: string) {
    scopeChain[0].add(name)
  }

  function isInScope(name: string): boolean {
    return scopeChain.some(scope => scope.has(name));
  }

  function isRightPartOfAssignment(node: Identifier, parent: EsNode | null): boolean {
    return parent?.type === 'AssignmentPattern' && parent.right === node
  }

  function extractIdentifiers(pattern: Pattern): string[] {
    const identifers: string[] = []
    walk(pattern, {
      enter(node, parent) {
        if (node.type === 'Identifier' && !isRightPartOfAssignment(node, parent)) {
          identifers.push(node.name)
        }
      }
    })
    return identifers
  }

  function handleDestructuring(pattern: ObjectPattern | ArrayPattern) {
    walk(pattern, {
      enter(node, parent) {
        if (node.type === 'Identifier' && !isRightPartOfAssignment(node, parent)) {
          addToScope(node.name)
        }
      }
    });
  }

  walk(tree, {
    enter(node: EsNode, parent: EsNode | null) {
      if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        scopeChain.unshift(new Set());
        for (const param of node.params) {
          extractIdentifiers(param).forEach(addToScope)
        }
        if (node.type === 'FunctionExpression' && node.id) {
          addToScope(node.id.name)
        }
      }

      if (node.type === 'ObjectPattern' || node.type === 'ArrayPattern') {
        handleDestructuring(node);
      }

      if (node.type === 'VariableDeclaration') {
        for (const dec of node.declarations) {
          extractIdentifiers(dec.id).forEach(addToScope)
        }
      }

      if (node.type === 'Identifier') {
        if (
          // This is an object property key, not a variable reference
          !(parent?.type === 'Property' && !parent.computed && parent.key === node) &&
          // This is a member expression property, not a variable reference
          !(parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) &&
          !isInScope(node.name)
        ) {
          globals.add(node.name);
        }
      }
    },

    leave(node: EsNode) {
      if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        scopeChain.shift()
      }
    }
  })

  return Array.from(globals)
}
