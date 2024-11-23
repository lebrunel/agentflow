import { unified } from 'unified'
import { u } from 'unist-builder'
import { selectAll } from 'unist-util-select'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkStringify from 'remark-stringify'
import { toContextValue } from '../context'

import type { Processor } from 'unified'
import type { Root, RootContent } from 'mdast'
import type { Options } from 'remark-stringify'
import type { ExpressionNode } from '../ast'
import type { ContextValue } from '../context'

/**
 * Converts AST to string, evaluating expressions when an eval function is
 * provided in the options. Any evaluated expressions replace the original
 * expressions in the output string.
 */
export function stringify(root: Root, options: StringifyOptions = {}): string {
  const proc = createStringifier(options)

  if (typeof options.evaluate === 'function') {
    const evaluate = options.evaluate
    const children: RootContent[] = []

    for (const node of root.children) {
      const expressions = selectAll('expression', root) as ExpressionNode[]
      const extraChildren: RootContent[] = []

      if (expressions.length) {
        let nodeStr = proc.stringify(u('root', [node]))

        for (const expression of expressions) {
          const str = expression.value
          const result = toContextValue(evaluate(expression))
          nodeStr = result.type === 'primitive'
            ? nodeStr.replace(`{${str}}`, String(result.value))
            : nodeStr.replace(`{${str}}`, '')

          if (result.type !== 'primitive') {
            extraChildren.push(contextAsNode(result))
          }
        }

        const chunkRoot = proc.parse(nodeStr)
        children.push(...chunkRoot.children, ...extraChildren)
      } else {
        children.push(node)
      }
    }

    return proc.stringify(u('root', children)).trim()
  } else {
    return proc.stringify(root).trim()
  }
}

export function createStringifier(
  options: StringifyOptions = {}
): Processor<Root, undefined, undefined, Root, string> {
  options.bullet ||= '-'
  options.handlers ||= {}
  options.handlers.expression = (node: ExpressionNode) => `{${node.value}}`

  return unified()
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkParse)
    .use(remarkStringify, options)
}

function contextAsNode(ctx: ContextValue): RootContent {
  switch (ctx.type) {
    case 'primitive':
      return u('paragraph', [
        u('text', String(ctx.value))
      ])

    case 'file':
      return u('paragraph', [
        u('text', `![${ctx.value.type}](${ctx.value.name})`)
      ])

    case 'json':
      return u('code', {
        lang: 'json',
        value: JSON.stringify(ctx.value, null, 2),
      })
  }
}


// Types

export interface StringifyOptions extends Options {
  evaluate?: (node: ExpressionNode) => any
}
