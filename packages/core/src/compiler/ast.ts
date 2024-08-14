import { is } from 'unist-util-is'
import type { Code, InlineCode, Literal, Node, Parent, Root, ThematicBreak } from 'mdast'

import type { Workflow } from '~/compiler/workflow'

// Interfaces

export interface WorkflowNode extends Node {
  type: 'workflow';
  children: Array<Root | PhaseNode>;
}

export interface PhaseNode extends Parent {
  type: 'phase';
}

export interface ActionNode extends Literal {
  type: 'action';
  data: { type: string, name: string, props: any };
}

export interface ContextNode extends Literal {
  type: 'context';
}

// Type assertions

export function isActionDef(node: Node): node is Code {
  return is(node, n => n.type === 'code' && /^\w+@\w+/.test((n as Code).lang || ''))
}

export function isActionNode(node: Node): node is ActionNode {
  return is(node, 'action')
}

export function isBreak(node: Node): node is ThematicBreak {
  return is(node, 'thematicBreak')
}

export function isContextDef(node: Node): node is InlineCode {
  return is(node, n => n.type === 'inlineCode' && /^@\w+/.test((n as InlineCode).value))
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
    actionNode: ActionNode;
  }
}

declare module 'unified' {
  interface CompileResultMap {
    flow: Workflow;
  }
}