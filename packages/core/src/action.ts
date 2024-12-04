import { z } from 'zod'

import type { ContextValue } from './context'
import type { ExecutionContext } from './exec'

export function defineAction<T extends z.ZodObject<any>>(
  options: ActionOptions<T>,
): Action<z.infer<T>> {
  const { name, helpers, execute } = options
  const expressionAwareSchema = makeExpressionAware(options.schema)

  return {
    name,
    helpers,
    execute,
    parse: (props) => expressionAwareSchema.parse(props),
  }
}

const expressionSchema = z.object({
  type: z.literal('expression'),
  expressionType: z.string(),
  data: z.any().optional(),
  value: z.string(),
}).passthrough()

function makeExpressionAware<T extends z.ZodObject<any>>(schema: T): T {
  const newShape = Object.entries(schema.shape).reduce((shape, [key, zodType]) => {
    shape[key] = expressionSchema.or(zodType as z.ZodType)
    return shape
  }, { as: z.string() } as {[K in keyof typeof schema.shape]: z.ZodType })

  return z.object(newShape) as T
}

export type ActionName = string

export interface Action<T = any> {
  name: ActionName;
  helpers?: ActionHelpers | ActionHelpersFn;
  execute: ActionFn<T>;
  parse: (props: any) => T;
  //validate: (props: any, opts: { shapeOnly?: boolean }) => void;
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
