import { z } from 'zod'

import type { CompletionTokenUsage } from 'ai'
import type { Pushable } from 'it-pushable'
import type { ContextName, ContextValue, ContextTextValue } from './context'
import type { Runtime, ExecutionCursor } from './runtime'
import type { WorkflowAction } from './workflow'

export function defineAction<T extends z.ZodObject<any>>(options: ActionOptions<T>): Action<z.infer<T>> {
  const { name, execute } = options

  // Validation is called twice:
  // - at compilation we only validate the shape
  // - at runtime (after expressions converted to values) we validate fully
  function validate(props: any, fullValidation: boolean = false): void {
    // todo - improve action prop validation - all actions require a "name" prop cor context name
    // - do need a better way of defining the name rather than mixing with props ??
    const schema = fullValidation
      ? options.schema
      : z.object(
          Object.fromEntries(
            Object.keys(options.schema.shape).map(key => {
              return [
                key,
                z.any().refine(
                  val => typeof val !== 'undefined',
                  { message: `Property '${key}' is required` },
                )
              ]
            })
          )
        )

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
  validate: (props: any, fullValidation?: boolean) => void;
}

export interface ActionOptions<T extends z.ZodObject<any>> {
  name: ActionName;
  schema: T;
  execute: ActionFn<z.infer<T>>;
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
