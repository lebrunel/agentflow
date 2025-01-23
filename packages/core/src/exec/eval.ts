import vm from 'node:vm'
import { walk } from 'estree-walker'
import { dedent } from 'ts-dedent'
import { stringify, createFragmentProcessor } from '../ast'
import { FRAGMENT_SYMBOL } from '../context'

import type { ExpressionNode } from '../ast'
import type { Context, Fragment } from '../context'
import type { Environment } from '../env'
import type {
  Identifier,
  Node as EsNode,
  Program,
  Pattern,
  ObjectPattern,
  ArrayPattern
} from 'estree-jsx'

export function createSealedEvaluator(env: Environment, context: Context = {}) {
  const ctx = createEvalContext(env, context)
  return <T = any>(expression: ExpressionNode): T => {
    return evalExpression<T>(expression, ctx)
  }
}

export function createDynamicEvaluator(env: Environment) {
  return <T = any>(expression: ExpressionNode, context: Context = {}): T => {
    const ctx = createEvalContext(env, context)
    return evalExpression<T>(expression, ctx)
  }
}

function createEvalContext(env: Environment, context: Context = {}): vm.Context {
  function _fragment(path: string, ctx: Context = {}): Fragment {
    const evaluate = createSealedEvaluator(env, ctx)
    const proc = createFragmentProcessor(env)
    const ast = proc.parse(path)
    const src = stringify(proc.runSync(ast), { evaluate })
    return [FRAGMENT_SYMBOL, src]
  }

  return vm.createContext({ ...context, dedent, _fragment }, {
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: 'afterEvaluate',
  })
}

function evalExpression<T = any>(expression: ExpressionNode, context: vm.Context): T {
  try {
    const script = new vm.Script(expression.value)
    return script.runInContext(context, {
      timeout: 50,
      breakOnSigint: true,
    })
  } catch(e) {
    // todo catch timeouts
    console.log('~~')
    console.log(e)
    return Symbol.for('fail') as any
  }
}

/**
 * Extracts dependencies from the given expression. This function helps
 * identify the variables that the expression relies on for evaluation.
 */
export function getExpressionDependencies(expression: ExpressionNode | EsNode): string[] {
  const root = expression.type === 'expression'
    ? expression.data!.estree! as Program
    : expression

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

  walk(root, {
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
          !isInScope(node.name) &&
          !node.name.startsWith('_')
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
