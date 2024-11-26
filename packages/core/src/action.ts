import { z } from 'zod'

import type { ContextValue } from './context'
import type { ExecutionContext } from './exec'

const BaseSchema = z.object({ as: z.string() })

export function defineAction<T extends z.ZodObject<any>>(
  options: ActionOptions<T>,
): Action<z.infer<T>> {
  const { name, helpers, execute } = options

  function parse(props: any): z.infer<T> {
    return options.schema.parse(props)
  }

  function validate(props: any, { shapeOnly = false }): void {
    const baseSchema = BaseSchema.merge(options.schema).strict() as z.ZodObject<any>

    if (shapeOnly) {
      const entries = Object.keys(baseSchema.shape).map(key => {
        const prop = baseSchema.shape[key]
        const type = prop instanceof z.ZodOptional || prop instanceof z.ZodDefault
          ? z.any()
          : z.any().refine(
            (val: any) => typeof val !== 'undefined',
            { message: `Property '${key}' is required` }
          )
        return [ key, type ]
      })

      z.object(Object.fromEntries(entries)).parse(props)

    } else {
      baseSchema.parse(props)
    }
  }

  return {
    name,
    helpers,
    execute,
    parse,
    validate,
  }
}

export type ActionName = string

export interface Action<T = any> {
  name: ActionName;
  helpers?: ActionHelpers | ActionHelpersFn;
  execute: ActionFn<T>;
  parse: (props: any) => T;
  validate: (props: any, opts: { shapeOnly?: boolean }) => void;
}

export type ActionFn<T> = (
  ctx: ExecutionContext,
  props: T,
) => ContextValue | PromiseLike<ContextValue>

export type ActionHelpers = {
  [name: string]: any;
}

export type ActionHelpersFn = (ctx: ExecutionContext) => ActionHelpers

export interface ActionOptions<T extends z.ZodObject<any>> {
  name: ActionName;
  schema: T;
  helpers?: ActionHelpers | ActionHelpersFn;
  execute: ActionFn<z.infer<T>>;
}
