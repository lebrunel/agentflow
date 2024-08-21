import { z } from 'zod'
import type { CompletionTokenUsage } from 'ai'
import type { Pushable } from 'it-pushable'

import type { Action } from '../compiler/action'
import type { ContextName, ContextValue, ContextTextValue } from './context'
import type { Runtime } from './runtime'
import type { ExecutionCursor } from './state'

export function defineAction<T extends z.ZodType>(options: ActionOptions<T>): ActionHandler<z.infer<T>> {
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

export interface ActionHandler<T = any> {
  name: ActionTypeName;
  execute: ActionFn<T>
  validate: (props: T) => void;
}

export interface ActionOptions<T extends z.ZodType> {
  name: ActionTypeName;
  schema: T;
  execute: ActionFn<z.infer<T>>;
  validate?: (props: z.infer<T>) => void;
}

export interface ActionContext<T = any> {
  action: Action<T>;
  input: ContextValue[];
  results: ActionResultLog[];
  stream: Pushable<string>;
}

export interface ActionEvent {
  action: Action;
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
  type: ActionTypeName;
  name: ContextName;
  input: ContextValue[];
  output: ContextTextValue;
  usage?: CompletionTokenUsage;
}

export type ActionTypeName = string

export type ActionFn<T> = (
  ctx: ActionContext<T>,
  runtime: Runtime,
) => ActionResult | PromiseLike<ActionResult>
