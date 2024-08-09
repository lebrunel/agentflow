import type { RootContent } from 'mdast'
import { Action } from './action'
import { GenerateAction } from './generate'
import type { ActionNode } from '../ast'

export { Action }
export { GenerateAction } from './generate'

export function createAction(node: ActionNode, contentNodes: RootContent[]): Action {
  // todo - handle multiple action types
  return new GenerateAction(node, contentNodes)
}

