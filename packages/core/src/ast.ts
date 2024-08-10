import { is } from 'unist-util-is'
import type { Literal, Node, Root, Parent } from 'mdast'
import type { Workflow } from './workflow'

// Interfaces

export interface WorkflowNode extends Node {
  type: 'workflow';
  children: Array<Root | PhaseNode>;
}

export interface PhaseNode extends Parent {
  type: 'phase';
}

export interface ActionNode<P = any> extends Literal {
  type: 'action';
  data: { type: string, name: string, props: P };
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

// Augment mdast and unified with custom types

declare module 'mdast' {
  interface PhrasingContentMap {
    conextNode: ContextNode;
  }

  interface RootContentMap {
    actionNode: ActionNode<unknown>;
  }
}

declare module 'unified' {
  interface CompileResultMap {
    flow: Workflow;
  }
}