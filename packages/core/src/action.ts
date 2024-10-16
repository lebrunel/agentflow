import { z } from 'zod'

import type { LanguageModelUsage } from 'ai'
import type { Pushable } from 'it-pushable'
import type { ContextValue } from './context'
import type { ExecutionController, Runtime } from './runtime'

export function defineAction<T extends z.ZodObject<any>>(options: ActionOptions<T>): Action<z.infer<T>> {
  const { name, helpers, execute } = options

  const baseSchema = z.object({
    as: z.string(),
  }).merge(options.schema).strict() as z.ZodObject<any>

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
    helpers,
    execute,
    parse,
    validate,
  }
}

export interface Action<T = any> {
  name: ActionName;
  helpers?: ActionHelpers | ActionHelpersFn;
  execute: ActionFn<T>
  parse: (props: any) => T;
  validate: (props: any, shapeOnly?: boolean) => void;
}

export interface ActionOptions<T extends z.ZodObject<any>> {
  name: ActionName;
  schema: T;
  helpers?: ActionHelpers | ActionHelpersFn;
  execute: ActionFn<z.infer<T>>;
}

export type ActionName = string

export type ActionHelpers = {
  [name: string]: any;
}

export type ActionHelpersFn = (controller: ExecutionController) => ActionHelpers

export type ActionContext = {
  input: ContextValue[],
  results: ActionLog[],
  meta: ActionMeta,
  runtime: Runtime,
  stream: Pushable<string>,
}

export type ActionFn<T> = (props: T, context: ActionContext) => ContextValue | PromiseLike<ContextValue>

export interface ActionResult {
  result: ContextValue;
  meta?: ActionMeta;
}

export interface ActionMeta {
  usage?: LanguageModelUsage;
}

export interface ActionLog {
  cursor: string;
  actionName: string;
  contextKey: string;
  input: ContextValue[];
  output: ContextValue;
  meta: ActionMeta;
}
