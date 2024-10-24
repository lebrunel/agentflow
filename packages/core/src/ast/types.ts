import type { Node, Root, RootContent } from 'mdast'
import type { MdxJsxExpressionAttributeData } from 'mdast-util-mdx-jsx'
import type { Workflow } from 'src/workflow';

// AST types

export type ExpressionNodeType = 'flow' | 'text' | 'attribute'

export interface ActionNode extends Node {
  type: 'action';
  name: string;
  children: RootContent[];
  attributes: Record<string, any>;
}

export interface ExpressionNode extends Node {
  type: 'expression';
  expressionType: ExpressionNodeType;
  data?: MdxJsxExpressionAttributeData;
  value: string;
}

// Workflow view types

export interface WorkflowScope {
  phases: WorkflowPhase[];
  parentNode?: ActionNode;
}

export interface WorkflowPhase {
  steps: WorkflowStep[];
  //execNodes: Array<ActionNode | ExpressionNode>;
}

export interface WorkflowStep {
  content: Root;
  expressions: ExpressionNode[];
  action?: ActionNode;
  childScope?: WorkflowScope;
}

export interface WorkflowWalker<T extends Record<string, any>> {
  onScope?: (scope: WorkflowScope, parentCtx: Readonly<T>) => T;
  onPhase?: (phase: WorkflowPhase, context: T) => void;
  onStep?: (action: WorkflowStep, context: T) => void;
}

// Extending mdast

declare module 'mdast' {
  interface PhrasingContentMap {
    actionNode: ActionNode;
    expressionNode: ExpressionNode;
  }

  interface RootContentMap {
    actionNode: ActionNode;
    expressionNode: ExpressionNode;
  }
}

// Extending unified

declare module 'unified' {
  interface CompileResultMap {
    workflow: Workflow;
  }
}
