import { evaluate, variables } from 'eval-estree-expression'
import { z } from 'zod'
import escodegen from 'escodegen'

import type { ExpressionStatement } from 'acorn'
import type { Node } from 'estree'
import type { Program } from 'estree-jsx'
import type { ContextValueMap } from '../context'

/**
 * Evaluates an expression tree asynchronously using the provided context.
 * This function iterates through the body of the program, evaluating each
 * expression statement and returning the result of the last one.
 */
export async function evalExpression<T = any>(
  tree: Program,
  context: Record<string, any> = {},
): Promise<T> {
  let result: any
  // Evaluate all the statements, even though only the last one matters
  for (const statement of tree.body) {
    if (statement.type === 'ExpressionStatement') {
      result = await evaluate(
        statement.expression as Node,
        { ...context, z },
        { functions: true, generate: escodegen.generate },
      )
    }
  }

  return result
}

/**
 * Evaluates an expression tree synchronously using the provided context.
 * This function iterates through the body of the program, evaluating each
 * expression statement and returning the result of the last one.
 */
export function evalExpressionSync<T = any>(
  tree: Program,
  context: Record<string, any> = {},
): T {
  let result: any
  // Evaluate all the statements, even though only the last one matters
  for (const statement of tree.body) {
    if (statement.type === 'ExpressionStatement') {
      result = evaluate.sync(
        statement.expression as Node,
        { ...context, z },
        { functions: true, generate: escodegen.generate },
      )
    }
  }

  return result
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
      { functions: true, generate: escodegen.generate },
    )
  })
}
