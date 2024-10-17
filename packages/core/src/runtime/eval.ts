import vm from 'node:vm'
import { walk } from 'estree-walker'
import { z } from 'zod'

import type { Identifier, Node, Program, Pattern, ObjectPattern, ArrayPattern } from 'estree-jsx'

// Always passed into the eval context
const globals = {
  z
}

/**
 * Evaluates an expression synchronously using the provided context, returning
 * the result of the expression.
 */
export function evalExpression<T = any>(
  expression: string,
  context: Record<string, any>,
  computed: Record<string, any> = {},
): T {
  try {
    const script = new vm.Script(`(${expression.trim()})`)
    return script.runInNewContext({
      ...context,
      ...globals,
      ...computed,
    }, {
      timeout: 50,
      breakOnSigint: true,
      contextCodeGeneration: { strings: false, wasm: false },
      microtaskMode: 'afterEvaluate',
    })
  } catch(e) {
    // todo catch timeouts
    return Symbol.for('fail') as any
  }
}

/**
 * Evaluates the dependencies of an expression tree by extracting variables
 * from each expression statement in the program body. This function helps
 * identify the variables that the expression relies on for evaluation.
 */
export function evalDependencies(tree: Program): string[] {
  const globals = new Set<string>()
  const scopeChain: Array<Set<string>> = [new Set()]

  function addToScope(name: string) {
    scopeChain[0].add(name)
  }

  function isInScope(name: string): boolean {
    return scopeChain.some(scope => scope.has(name));
  }

  function isRightPartOfAssignment(node: Identifier, parent: Node | null): boolean {
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
    enter(node: Node, parent: Node | null) {
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

    leave(node: Node) {
      if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        scopeChain.shift()
      }
    }
  })

  return Array.from(globals)
}
