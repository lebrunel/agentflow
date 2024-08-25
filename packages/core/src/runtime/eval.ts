import { evaluate as _eval, variables } from 'eval-estree-expression'
import type { ExpressionStatement } from 'acorn'
import type { Node } from 'estree'
import type { Program } from 'estree-jsx'

import type { ContextValueMap } from '../workflow/context'

export async function evalExpression<T = any>(tree: Program, context: ContextValueMap): Promise<T> {
  const ctx = reduceContext(context)

  let result: any
  // Evaluate all the statements, even though only the last one matters
  for (const statement of tree.body) {
    if (statement.type === 'ExpressionStatement') {
      result = await _eval(statement.expression as Node, ctx)
    }
  }

  return result
}

export function evalExpressionSync<T = any>(tree: Program, context: ContextValueMap): T {
  const ctx = reduceContext(context)

  let result: any
  // Evaluate all the statements, even though only the last one matters
  for (const statement of tree.body) {
    if (statement.type === 'ExpressionStatement') {
      result = _eval.sync(statement.expression as Node, ctx)
    }
  }

  return result
}

export function evalDependencies(tree: Program): string[] {
  return tree.body.flatMap(statement => {
    const expression = (statement as ExpressionStatement).expression
    return variables(expression as Node)
  })
}

function reduceContext(context: ContextValueMap): Record<string, any> {
  return Object.entries(context).reduce((ctx, [name, { value }]) => {
    return Object.assign(ctx, { [name]: value })
  }, {})
}
