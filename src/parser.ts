import { unified, type Processor, type Transformer } from 'unified'
import { u } from 'unist-builder'
import { matter as setMatter } from 'vfile-matter'
import { visit } from 'unist-util-visit'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import type { Node, Code, InlineCode, Paragraph, Root } from 'mdast'
import type { VFile } from 'vfile'
import type { WorkflowNode, PhaseNode } from './ast'
import { Workflow } from './workflow'

export function parseFlow(src: string): Workflow {
  const proc = parseProcessor()
  const file = proc.processSync(src)
  return file.result
}

export function parseProcessor(): Processor<Root, Root, WorkflowNode, WorkflowNode, Workflow> {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(workflowData)
    .use(workflowPhases)
    .use(workflowContext)
    .use(workflowGenerate)
    .use<[], WorkflowNode, Workflow>(workflowCompile)
}

function workflowCompile(this: Processor) {
  this.compiler = (node, file) => new Workflow(node as WorkflowNode, file as FileWithData)
}

function workflowData(): Transformer<Root> {
  return function(tree, file) {
    setMatter(file)
    setTitle(file as FileWithData, tree)
  }
}


function workflowPhases(): Transformer<Root, WorkflowNode> {
  return function(root) {
    const children: Node[] = []
    let currentGroup: Node[] = []
    let hasRoutine = false

    function processGroup() {
      if (currentGroup.length === 0) return
      if (hasRoutine || currentGroup.some(n => n.type === 'code' && (<Code>n).lang === 'generate')) {
        hasRoutine = true
        children.push(u('phase', currentGroup))
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
    return u('workflow', children)
  }
}

function workflowContext(): Transformer<WorkflowNode> {
  return function(tree) {
    visit(tree, 'inlineCode', (node: InlineCode, i: number, parent: Paragraph) => {
      if (/^@\w+/.test(node.value)) {
        parent.children[i] = u('context', node.value)
      }
    })
  }
}

function workflowGenerate(): Transformer<WorkflowNode> {
  return function(tree) {
    visit(tree, 'code', (node: Code, i: number, parent: PhaseNode) => {
      if (node.lang === 'generate') {
        parent.children[i] = u('generate', node.value)
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
