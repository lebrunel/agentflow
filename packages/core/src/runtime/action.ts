import { TypeCompiler } from '@sinclair/typebox/compiler'
import { dd } from '~/util'

import type { Static, TSchema } from '@sinclair/typebox'
import type { CompletionUsage } from 'ai'
import type { Pushable } from 'it-pushable'
import type { ContextName, ContextValue } from '~/runtime/context'
import type { Runtime } from '~/runtime/runtime'

export function defineAction<T extends TSchema>(options: ActionOptions<T>): ActionHandler<Static<T>> {
  const { name, schema, execute } = options

  // Compile the schema for faster validation
  const compiledSchema = TypeCompiler.Compile(schema)

  // Use validate option or default validator
  const validate = options.validate || function(props: Static<T>) {
    if (!compiledSchema.Check(props)) {
      const errors: string[] = []
      for (const error of compiledSchema.Errors(props)) {
        errors.push(error.message)
      }
      throw new Error(dd`
      Invalid props for action '${name}':
      - ${errors.join('\n- ')}
      `)
    }
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

export interface ActionOptions<T extends TSchema> {
  name: ActionTypeName;
  schema: T;
  execute: ActionFn<Static<T>>;
  validate?: (props: Static<T>) => void;
}

export interface ActionResult {
  type: ActionTypeName;
  name: ContextName;
  input: ContextValue;
  output: ContextValue;
  usage?: CompletionUsage;
}

export interface ActionContext<T> {
  props: T;
  runtime: Runtime;
  stream?: Pushable<string>;
}

export type ActionTypeName = string

export type ActionFn<T> = (
  ctx: ActionContext<T>,
  input: ContextValue,
  prevResults: ActionResult[],
) => ContextValue | PromiseLike<ContextValue>
