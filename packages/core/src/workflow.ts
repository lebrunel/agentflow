import type { RootContent } from 'mdast'

import type { ContextTypeMap } from './context'
import type { WorkflowInputSchema } from './runtime'

export class Workflow {
  constructor(
    public title: string,
    readonly descriptionNodes: ReadonlyArray<RootContent>,
    readonly inputSchema: Readonly<WorkflowInputSchema>,
    readonly phases: ReadonlyArray<WorkflowPhase>,
    readonly meta: Readonly<Record<string, any>> = {}
  ) {}
}

export interface WorkflowPhase {
  readonly actions: ReadonlyArray<WorkflowAction>;
  readonly dependencies: ReadonlySet<string>;
  readonly inputTypes: Readonly<ContextTypeMap>;
  readonly outputTypes: Readonly<ContextTypeMap>;
  readonly trailingNodes: ReadonlyArray<RootContent>;
}

export interface WorkflowAction<T = any> {
  readonly name: string;
  readonly contextKey: string;
  readonly contentNodes: ReadonlyArray<RootContent>;
  readonly props: Readonly<T>;
}
