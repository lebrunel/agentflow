import type { Node, Root, RootContent } from 'mdast'
import type { Handlers } from 'mdast-util-to-markdown'
import type { MdxJsxExpressionAttributeData } from 'mdast-util-mdx-jsx'
import type { Workflow } from '../workflow'

export interface WorkflowNode extends Node {
  type: 'workflow';
  children: Array<Root | PhaseNode>;
}

export interface PhaseNode extends Node {
  type: 'phase';
  children: Array<RootContent>;
}

export interface ActionNode extends Node {
  type: 'action';
  name: string;
  children: RootContent[] | PhaseNode[];
  attributes: Record<string, any>;
}

export interface ExpressionNode extends Node {
  type: 'expression';
  data?: MdxJsxExpressionAttributeData;
  value: string;
}

export interface CustomHandlers extends Handlers {
  expression: (node: ExpressionNode) => string
}

declare module 'mdast' {
  interface PhrasingContentMap {
    conextNode: ExpressionNode;
  }

  interface BlockContentMap {
    actionNode: ActionNode;
  }

  interface RootContentMap {
    actionNode: ActionNode;
  }
}

declare module 'unified' {
  interface CompileResultMap {
    workflow: Workflow;
  }
}
