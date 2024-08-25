import { u } from 'unist-builder'
import { is } from 'unist-util-is'
import { visit, CONTINUE, SKIP } from 'unist-util-visit'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import type { Root } from 'mdast'
import type { Transformer } from 'unified'

import { WorkflowInputSchema } from '../../workflow/inputs'
import type { ExpressionNode } from '../ast'

/**
 * A unified transformer that traverses MDX AST, and parses YAML frontmatter,
 * validates input schemas, and transforms MDX elements into custom node types
 * for further processing.
 */
export function workflowVisitor(): Transformer<Root, Root> {
  return (tree, file) => {
    visit(tree, (node, i, parent) => {
      if (typeof i === 'undefined') return

      if (is(node, 'yaml')) {
        try {
          node.data = parseYaml(node.value)
          WorkflowInputSchema.parse((node.data as any).inputs || {})
        } catch(e: any) {
          if (e instanceof z.ZodError) {
            for (const issue of e.issues) {
              file.fail(
                `Invalid input schema at \`${issue.path.join('.')}\`. ${issue.message}`,
                node,
                'workflow-parse:invalid-input-schema'
              )
            }
          } else {
            file.fail(e as Error, node, 'workflow-parse:yaml-error')
          }
        }
        return SKIP
      }

      if (is(node, 'mdxJsxFlowElement')) {
        // todo - validate action name
        //if (!allowedActions.includes(node.name)) {
        //  file.fail('', node, 'workflow-parse:error')
        //  return SKIP
        //}

        const { name, children, position } = node
        const attributes: Record<string, any> = {}

        for (const attr of node.attributes) {
          if (attr.type === 'mdxJsxAttribute') {
            const value = is(attr.value, 'mdxJsxAttributeValueExpression')
              ? {
                  type: 'expression',
                  value: attr.value.value,
                  position: attr.value.position
                } as ExpressionNode
              : attr.value
            attributes[attr.name] = value
          } else {
            file.message(
              'Unsupported attribute syntax in Action. Use key-value pairs only.',
              attr,
              'workflow-parse:unsupported-attribute-syntax'
            )
          }
        }

        // todo - validate attributes against action schema

        parent!.children[i] = u('action', { name: name!, children, attributes, position })
        return CONTINUE
      }

      if (is(node, 'mdxJsxTextElement')) {
        file.fail('Action must be a block-level element', node, 'workflow-parse:action-inline')
        return SKIP
      }

      if (is(node, 'mdxFlowExpression')) {
        // todo - validate expression statement
        parent!.children[i] = u('paragraph', [
          u('expression', {
            value: node.value,
            position: node.position,
            data: node.data,
          })
        ])
        return SKIP
      }

      if (is(node, 'mdxTextExpression')) {
        // todo - validate expression statement
        parent!.children[i] = u('expression', {
          value: node.value,
          position: node.position,
          data: node.data,
        })
        return SKIP
      }
    })
  }
}
