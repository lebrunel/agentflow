import { unified } from 'unified'
import { u } from 'unist-builder'
import remarkStringify from 'remark-stringify'
import { Action, type ActionResult } from './action'

export class GenerateAction extends Action {
  async execute(): Promise<ActionResult> {
    
  }
}

function stringifyContent(nodes: RootContent[]): string {
  return unified()
    .use(remarkStringify)
    .stringify(u('root', nodes))
    .trim()
}