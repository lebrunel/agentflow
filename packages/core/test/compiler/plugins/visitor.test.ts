import { describe, expect, test } from 'bun:test'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { selectAll } from 'unist-util-select'
import { default as dd } from 'ts-dedent'

import type { ActionNode } from '~/index'
import { workflowVisitor } from '~/compiler/plugins'

function parse(src: string) {
  const proc = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMdx)
    .use(workflowVisitor, {})

  return proc.runSync(proc.parse(src))
}

describe('workflowVisitor()', () => {
  test('strips all blockquote blocks from the AST', () => {
    const ast = parse(dd`
    # Title

    A paragraph

    > A comment block

    Another paragraph

    <GenerateText as="foo" model="openai:gpt-4o" />

    <Loop as="loop" until={$index === 5}>
      > A nested comment block

      <GenerateText as="bar" model="openai:gpt-4o" />
    </Loop>
    `)

    const loopNode = ast.children[ast.children.length - 1] as ActionNode
    expect(ast.children).toHaveLength(5)
    expect(loopNode.children).toHaveLength(1)
    expect(selectAll('blockquote', ast)).toHaveLength(0)
  })
})
