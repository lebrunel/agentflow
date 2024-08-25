import type { Node, Root, RootContent } from 'mdast'
import type { MdxJsxExpressionAttributeData } from 'mdast-util-mdx-jsx'

import { Workflow } from '../workflow/workflow'

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
  children: Array<RootContent>;
  attributes: Record<string, any>;
}

export interface ExpressionNode extends Node {
  type: 'expression';
  data?: MdxJsxExpressionAttributeData;
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
    flow: Workflow;
  }
}
