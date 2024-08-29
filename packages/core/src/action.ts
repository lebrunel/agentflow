import { z } from 'zod'

import type { CompletionTokenUsage } from 'ai'
import type { Pushable } from 'it-pushable'
import type { ContextKey, ContextValue } from './context'
import type { Runtime, ExecutionCursor } from './runtime'
import type { WorkflowAction } from './workflow'

export function defineAction<T extends z.ZodObject<any>>(options: ActionOptions<T>): Action<z.infer<T>> {
  const { name, schema, execute } = options

  const baseSchema = z.object({ as: z.string() }).merge(options.schema).strict() as z.ZodObject<any>

  const isDefined = (val: any) => typeof val !== 'undefined'

  function parse(props: any): z.infer<T> {
    return options.schema.parse(props)
  }

  function validate(props: any, shapeOnly: boolean = false): void {
    const schema = !shapeOnly ? baseSchema : z.object(
        Object.fromEntries(
          Object.keys(baseSchema.shape).map(key => {
            const prop = baseSchema.shape[key]
            const type = prop instanceof z.ZodOptional || prop instanceof z.ZodDefault
              ? z.any()
              : z.any().refine(isDefined, { message: `Property '${key}' is required` })
            return [ key, type ]
          })
        )
      )

    schema.parse(props)
  }

  return {
    name,
    execute,
    parse,
    validate,
  }
}

export interface Action<T = any> {
  name: ActionName;
  execute: ActionFn<T>
  parse: (props: any) => T;
  validate: (props: any, shapeOnly?: boolean) => void;
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
  output: ContextValue;
  usage?: CompletionTokenUsage;
}

export interface ActionResultLog {
  cursor: ExecutionCursor;
  name: ActionName;
  contextKey: ContextKey;
  input: ContextValue[];
  output: ContextValue;
  usage?: CompletionTokenUsage;
}

export type ActionName = string

export type ActionFn<T> = (
  ctx: ActionContext<T>,
  runtime: Runtime,
) => ActionResult | PromiseLike<ActionResult>
