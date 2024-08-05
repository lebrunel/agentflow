import type { Node } from 'mdast'
import type { Flow } from './flow'

export interface FlowRootNode extends Node {
  type: 'flow-root';
  children: Node[];
}

export interface FlowRoutineNode extends Node {
  type: 'flow-routine';
  children: Node[];
}

export interface FlowContextNode extends Node {
  type: 'flow-context';
  value: string;
}

export interface FlowGenerateNode extends Node {
  type: 'flow-generate';
  value: string;
}

declare module 'mdast' {
  interface PhrasingContentMap {
    flowConextNode: FlowContextNode;
  }
}

declare module 'unified' {
  interface CompileResultMap {
    flow: Flow;
  }
}