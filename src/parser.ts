import { unified, type Processor, type Transformer } from 'unified'
import { u } from 'unist-builder'
import { matter as setMatter } from 'vfile-matter'
import { visit } from 'unist-util-visit'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import type { Node, Code, InlineCode, Paragraph, Root } from 'mdast'
import type { VFile } from 'vfile'
import type { FlowRootNode, FlowRoutineNode } from './ast'
import { compileFlow, Flow } from './flow'

export function parseFlow(src: string): Flow {
  const proc = parseProcessor()
  const file = proc.processSync(src)
  return file.result
}

export function parseProcessor(): Processor<Root, Root, FlowRootNode, FlowRootNode, Flow> {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(flowData)
    .use(flowRoutines)
    .use(flowContext)
    .use(flowGenerate)
    .use<[], FlowRootNode, Flow>(function() {
      this.compiler = (node, file) => compileFlow(node as FlowRootNode, file as FileWithData)
    })
}

function flowData(): Transformer<Root> {
  return function(tree, file) {
    setMatter(file)
    setTitle(file as FileWithData, tree)
  }
}


function flowRoutines(): Transformer<Root, FlowRootNode> {
  return function(root) {
    const children: Node[] = []
    let currentGroup: Node[] = []
    let hasRoutine = false

    function processGroup() {
      if (currentGroup.length === 0) return
      if (hasRoutine || currentGroup.some(n => n.type === 'code' && (<Code>n).lang === 'generate')) {
        hasRoutine = true
        children.push(u('flow-routine', currentGroup))
      } else {
        children.push(...currentGroup)
      }
      currentGroup = []
    }

    for (let i = 0; i < root.children.length; i++) {
      const node = root.children[i]
      if (i === 0 && node.type === 'yaml') {
        children.push(node)
      } else {
        if (
          node.type === 'heading' &&
          (node.depth === 1 || node.depth === 2)
        ) { processGroup() }
        currentGroup.push(node)
      }
    }

    processGroup()
    return u('flow-root', children)
  }
}

function flowContext(): Transformer<FlowRootNode> {
  return function(tree) {
    visit(tree, 'inlineCode', (node: InlineCode, i: number, parent: Paragraph) => {
      if (/^@\w+/.test(node.value)) {
        parent.children[i] = u('flow-context', node.value)
      }
    })
  }
}

function flowGenerate(): Transformer<FlowRootNode> {
  return function(tree) {
    visit(tree, 'code', (node: Code, i: number, parent: FlowRoutineNode) => {
      if (node.lang === 'generate') {
        parent.children[i] = u('flow-generate', node.value)
      }
    })
  }
}

function setTitle(file: FileWithData , tree: Root) {
  let title: string | undefined = file.data.matter?.title

  if (!title) {
    const firstIdx = tree.children[0].type === 'yaml' ? 1 : 0
    const firstNode = tree.children[firstIdx]
    if (firstNode.type === 'heading') {
      visit(firstNode, 'text', (n) => {
        title = n.value
        return false
      })
    }
  }

  if (!title) {
    title = file.stem
  }

  if (title) {
    file.data.title = title
  }
}

export type FileWithData = VFile & { data: FileMetaData }

export type FileMetaData = {
  title: string;
  matter: {
    [key: string]: any;
  }
}
