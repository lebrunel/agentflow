import { is } from 'unist-util-is'
import type { Literal, Node, Root, RootContent, Parent } from 'mdast'
import type { Workflow } from './workflow'

export interface WorkflowNode extends Node {
  type: 'workflow';
  children: Array<Root | PhaseNode>;
}

export interface PhaseNode extends Parent {
  type: 'phase';
}

export interface ActionNode extends Literal {
  type: 'action';
  data: any;
}

export interface ContextNode extends Literal {
  type: 'context';
}

export function isActionNode(node: Node): node is ActionNode {
  return is(node, 'action')
}

export function isContextNode(node: Node): node is ContextNode {
  return is(node, 'context')
}

declare module 'mdast' {
  interface PhrasingContentMap {
    conextNode: ContextNode;
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