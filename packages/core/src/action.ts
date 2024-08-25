import { z } from 'zod'

import type { CompletionTokenUsage } from 'ai'
import type { Pushable } from 'it-pushable'
import type { ContextName, ContextValue, ContextTextValue } from './context'
import type { Runtime, ExecutionCursor } from './runtime'
import type { WorkflowAction } from './workflow'

export function defineAction<T extends z.ZodType>(options: ActionOptions<T>): Action<z.infer<T>> {
  const { name, schema, execute } = options

  // Use validate option or default validator
  const validate = options.validate || function(props: z.infer<T>) {
    schema.parse(props)
  }

  return {
    name,
    execute,
    validate,
  }
}

export interface Action<T = any> {
  name: ActionName;
  execute: ActionFn<T>
  validate: (props: T) => void;
}

export interface ActionOptions<T extends z.ZodType> {
  name: ActionName;
  schema: T;
  execute: ActionFn<z.infer<T>>;
  validate?: (props: z.infer<T>) => void;
}

export interface ActionContext<T = any> {
  action: WorkflowAction<T>;
  input: ContextValue[];
  results: ActionResultLog[];
  stream: Pushable<string>;
}

export interface ActionEvent<T = any> {
  action: WorkflowAction<T>;
  stream: Pushable<string>;
  input: string;
  result: PromiseLike<ActionResultLog>;
}

export interface ActionResult {
  output: ContextTextValue;
  usage?: CompletionTokenUsage;
}

export interface ActionResultLog {
  cursor: ExecutionCursor;
  type: ActionName;
  name: ContextName;
  input: ContextValue[];
  output: ContextTextValue;
  usage?: CompletionTokenUsage;
}

export type ActionName = string

export type ActionFn<T> = (
  ctx: ActionContext<T>,
  runtime: Runtime,
) => ActionResult | PromiseLike<ActionResult>
