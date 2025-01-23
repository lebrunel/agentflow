import { unified } from 'unified'
import { u } from 'unist-builder'
import { selectAll } from 'unist-util-select'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkStringify from 'remark-stringify'
import { toContextValue } from '../context'

import type { Processor } from 'unified'
import type { Root, RootContent } from 'mdast'
import type { Options } from 'remark-stringify'
import type { ExpressionNode } from '../ast'
import type { ContextValue } from '../context'

export function contextify(root: Root, options: StringifyOptions = {}): ContextValue[] {
  const proc = createStringifier(options)
  const output: ContextValue[] = []

  if (typeof options.evaluate === 'function') {
    for (const node of root.children) {
      const expressions = selectAll('expression', node) as ExpressionNode[]
      const extras: ContextValue[] = []
      let value = proc.stringify(u('root', [node])).trim()

      if (expressions.length) {
        for (const expression of expressions) {
          const str = expression.value
          const result = toContextValue(options.evaluate(expression))
          value = result.type === 'primitive'
            ? value.replace(`{${str}}`, String(result.value))
            : value.replace(`{${str}}`, '')

          if (result.type !== 'primitive') {
            extras.push(result)
          }
        }
      }

      output.push({ type: 'primitive', value }, ...extras)
    }
  } else {
    const value = proc.stringify(root)
    output.push({ type: 'primitive', value })
  }

  // Normalize output so adjacent primitive chunks are joinred togther
  return output.reduce((normalized, chunk, i) => {
    const prev = normalized[normalized.length - 1]

    // If both previous and current chunks are text, combine them
    // Otherwise, add the current chunk as a new element
    if (prev && prev.type === 'primitive' && chunk.type === 'primitive') {
      if (chunk.value !== '') {
        prev.value = prev.value + '\n\n' + chunk.value
      }
    } else {
      normalized.push(chunk)
    }

    return normalized
  }, [] as ContextValue[])
}

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
      const expressions = selectAll('expression', node) as ExpressionNode[]
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

export function stringifyContext(context: ContextValue | ContextValue[]): string {
  if (Array.isArray(context)) return context.map(stringifyContext).join('\n\n')
  return contextAsString(context)
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
    .use(remarkMdx)
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
        u('image', {
          alt: ctx.value.type,
          url: ctx.value.name,
        })
      ])

    case 'json':
      return u('code', {
        lang: 'json',
        value: JSON.stringify(ctx.value, null, 2),
      })

    default:
      throw new Error(`Unrecognised context type: ${JSON.stringify(ctx)}`)
  }
}

function contextAsString(ctx: ContextValue): string {
  switch(ctx.type) {
    case 'primitive':
      return String(ctx.value)

    case 'file':
      return `![${ctx.value.type}](${ctx.value.name})`

    case 'json':
      return `\`\`\`json\n${JSON.stringify(ctx.value, null, 2)}\n\`\`\``

    default:
      throw new Error(`Unrecognised context type: ${JSON.stringify(ctx)}`)
  }
}


// Types

export interface StringifyOptions extends Options {
  evaluate?: (node: ExpressionNode) => any
}
