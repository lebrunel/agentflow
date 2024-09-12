import vm from 'node:vm'
import { variables } from 'eval-estree-expression'
import { z } from 'zod'

import type { ExpressionStatement } from 'acorn'
import type { Node } from 'estree'
import type { Program } from 'estree-jsx'
import type { ComputedContext } from '~/context'

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
  computed: ComputedContext = {},
): T {
  try {
    const script = new vm.Script(`(${expression.trim()})`)
    return script.runInNewContext(buildContext(context, computed), {
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
  return tree.body.flatMap(statement => {
    const expression = (statement as ExpressionStatement).expression
    return variables(
      expression as Node,
    )
  })
}

function buildContext(
  context: Record<string, any>,
  computed: ComputedContext,
): Record<string, any> {
  return Object.entries(computed).reduce((ctx, [name, fn]) => {
    Object.defineProperty(ctx, name, {
      get: () => fn(),
      enumerable: true,
      configurable: true,
    })
    return ctx
  }, { ...context, ...globals })
}
