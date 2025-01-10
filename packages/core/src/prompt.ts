import type { Root } from 'mdast'
import type { Processor } from 'unified'

export class Prompt {
  #ast?: Root

  constructor(
    readonly name: string,
    readonly src: string,
    private proc: Processor<Root, Root, Root, Root, string>,
  ) { }

  process(): void {
    if (!this.#ast) {
      const stack = this.proc.data('promptStack') as string[]
      if (stack.includes(this.name)) {
        const cycle = [...stack, this.name].join(' > ')
        throw new Error(`Circular dependency: ${cycle}`)
      }
      stack.push(this.name)

      try {
        const ast = this.proc.parse(this.src)
        this.#ast = this.proc.runSync(ast)
      } finally {
        stack.pop()
      }
    }
  }

  toString(): string {
    if (!this.#ast) throw new Error('xxx todo - prompt has not been processed')
    return this.proc.stringify(this.#ast)
  }
}
