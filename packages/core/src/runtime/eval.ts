import { evaluate, variables } from 'eval-estree-expression'
import type { Program } from 'estree-jsx'
import type { ExpressionStatement } from 'acorn'
import type { Node } from 'estree'

import { contextType } from '~/workflow/context'
import type { ContextValue, ContextValueMap } from '~/workflow/context'

export function evalExpression(tree: Program, contextMap: ContextValueMap): ContextValue {
  const context: Record<string, any> = Object.entries(contextMap).reduce((ctx, [name, { value }]) => {
    return Object.assign(ctx, { [name]: value })
  }, {})

  // Evaluate all the statements, even though only the last one matters
  let result: any
  for (const statement of tree.body) {
    const expression = (statement as ExpressionStatement).expression
    result = evaluate.sync(expression as Node, context)
  }

  return {
    type: contextType(result),
    value: result
  }
}

export function evalDependencies(tree: Program): string[] {
  return tree.body.flatMap(statement => {
    const expression = (statement as ExpressionStatement).expression
    return variables(expression as Node)
  })
}
