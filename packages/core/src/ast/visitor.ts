import { is } from 'unist-util-is'
import { visit } from 'unist-util-visit'
import { walk } from 'estree-walker'

import type { Node as MdNode, Parent } from 'mdast'
import type { Node as EsNode } from 'estree-jsx'
import type { VisitorResult } from 'unist-util-visit'
import type { VFile } from 'vfile'

/**
 * Returns a visitor instance that will walk an entire AST comprising both
 * mdast and estree nodes.
 */
export function visitor(root: MdNode | EsNode, file: VFile): VisitorBuilder {
  return new VisitorBuilder(root, file)
}

class VisitorBuilder {
  private visitors: VisitorMap = {
    'md:enter': [],
    'md:leave': [],
    'es:enter': [],
    'es:leave': []
  }

  constructor(private root: MdNode | EsNode, private file: VFile) {}

  on<T extends MdNode, Args extends any[]>(
    type: 'md:enter' | 'md:leave',
    visitor: VisitorFactory<T, Args>,
    ...args: Args
  ): this;
  on<T extends EsNode, Args extends any[]>(
    type: 'es:enter' | 'es:leave',
    visitor: VisitorFactory<T, Args>,
    ...args: Args
  ): this;
  on<T extends MdNode | EsNode, Args extends any[]>(
    type: VisitorType,
    visitor: VisitorFactory<T, Args>,
    ...args: Args
  ): this {
    this.visitors[type].push(visitor(...args) as any)
    return this
  }

  visit(): void {
    if (isMdNode(this.root)) {
      this.visitMdTree(this.root)
    } else {
      this.visitEsTree(this.root)
    }
  }

  private visitMdTree(root: MdNode): void {
    visit(root as Parent, (node, index, parent) => {
      let result: VisitorResult = true

      const ctx = createVisitorContext({
        remove() {
          assertIndex(index)
          parent!.children.splice(index, 1)
          result = Array.isArray(result) ? [result[0], index] : index
        },
        replace(replacement) {
          assertIndex(index)
          parent!.children[index] = replacement as Parent['children'][number]
          result = Array.isArray(result) ? [result[0], index] : index
        },
        skip() {
          result = typeof result === 'number' ? ['skip', result] : 'skip'
        }
      }, this.file)

      // Enter phase
      this.visitors['md:enter'].forEach(visitor =>
        visitor(ctx, node as MdAstContent, parent, index)
      )

      // Return early if skipping
      if (
        (result as VisitorResult) === 'skip' ||
        Array.isArray(result) && result[0] === 'skip'
      ) {
        return result
      }

      // Visit action attribute expressions
      if (is(node, 'action')) {
        for (const attr of Object.values(node.attributes)) {
          if (is(attr, 'expression')) {
            this.visitMdTree(attr)
          }
        }
      }

      // Visit expression estree nodes
      if (is(node, 'expression')) {
        this.visitEsTree(node.data!.estree!)
      }

      // Leave phase
      this.visitors['md:leave'].forEach(visitor =>
        visitor(ctx, node as MdAstContent, parent, index)
      )

      return result
    })
  }

  private visitEsTree(root: EsNode): void {
    const self = this

    walk(root, {
      enter(node, parent, prop, index) {
        const ctx = createVisitorContext(this, self.file)
        self.visitors['es:enter'].forEach(visitor => {
          visitor(ctx, node, parent, prop, index)
        })
      },
      leave(node, parent, prop, index) {
        const ctx = createVisitorContext(this, self.file)
        self.visitors['es:leave'].forEach(visitor => {
          visitor(ctx, node, parent, prop, index)
        })
      }
    })
  }
}

// Helpers

function assertIndex(val: number | null | undefined): asserts val is number {
  if (typeof val !== 'number') {
    throw new Error('Cannot remove/replace the root node. Operations are only valid on child nodes.')
  }
}

function createVisitorContext<T extends MdNode | EsNode>(
  ctx: Pick<VisitorContext<T>, 'remove' | 'replace' | 'skip'>,
  file: VFile,
): VisitorContext<T> {
  return {
    ...ctx,
    file,
  }
}

function isMdNode(node: any): node is MdNode {
  return 'position' in node
}

// Types

type MdAstContent = Parent['children'][number]

export type MdVisitor = (
  ctx: VisitorContext<MdNode>,
  node: MdAstContent,
  parent?: Parent,
  index?: number,
) => void

export type EsVisitor = (
  ctx: VisitorContext<EsNode>,
  node: EsNode,
  parent: EsNode | null,
  prop?: string | number | symbol | null,
  index?: number | null,
) => void

export interface VisitorContext<T extends MdNode | EsNode> {
  file: VFile;
  remove(): void;
  replace(node: T): void;
  skip(): void;
}

export type VisitorFactory<T extends MdNode | EsNode, Args extends any[]> = (
  ...args: Args
) => T extends EsNode ? EsVisitor : MdVisitor

type VisitorMap = {
  'md:enter': MdVisitor[],
  'md:leave': MdVisitor[],
  'es:enter': EsVisitor[],
  'es:leave': EsVisitor[],
}

type VisitorType = keyof VisitorMap
