import type { RootContent } from 'mdast'

import type { ContextKey, ContextValueMap } from './context'
import type { WorkflowInputSchema } from './runtime'

export class Workflow {
  constructor(
    public title: string,
    readonly descriptionNodes: ReadonlyArray<RootContent>,
    readonly initialContext: Readonly<ContextValueMap>,
    readonly inputSchema: Readonly<WorkflowInputSchema>,
    readonly phases: ReadonlyArray<WorkflowPhase>,
    readonly meta: Readonly<Record<string, any>> = {}
  ) {}
}

export interface WorkflowPhase {
  readonly actions: ReadonlyArray<WorkflowAction>;
  readonly contextKeys: ReadonlySet<ContextKey>;
  readonly trailingNodes: ReadonlyArray<RootContent>;
}

export interface WorkflowAction<T = any> {
  readonly name: string;
  readonly contextKey: string;
  readonly contentNodes: ReadonlyArray<RootContent>;
  readonly props: Readonly<T>;
  readonly phases: ReadonlyArray<WorkflowPhase>;
}
