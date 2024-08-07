import { is } from 'unist-util-is'
import { Value } from '@sinclair/typebox/value'
import { default as dd } from 'ts-dedent'
import type { Literal, Node, Root, Parent } from 'mdast'
import { ActionPropsSchema, type ActionProps } from './action'
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
  data: ActionProps;
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

export function validateActionNode(node: Node): asserts node is ActionNode {
  const error = Value.Errors(ActionPropsSchema, node.data).First()
  if (error) {
    console.log(node.position)
    throw new Error(dd`
    Invalid action as line ${node.position!.start.line}.
      Path: ${error.path}
      Error: ${error.message}
      Value: ${JSON.stringify(error.value)}
    `)
  }
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