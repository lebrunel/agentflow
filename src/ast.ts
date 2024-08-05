import type { Node, RootContent } from 'mdast'
import type { Workflow } from './workflow'

export interface WorkflowNode extends Node {
  type: 'workflow';
  children: Node[];
}

export interface PhaseNode extends Node {
  type: 'phase';
  children: Node[];
}

export interface ContextNode extends Node {
  type: 'context';
  value: string;
}

export interface GenerateNode extends Node {
  type: 'generate';
  value: string;
}

declare module 'mdast' {
  interface PhrasingContentMap {
    flowConextNode: ContextNode;
  }
}

declare module 'unified' {
  interface CompileResultMap {
    flow: Workflow;
  }
}