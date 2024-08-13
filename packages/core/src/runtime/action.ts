import { TypeCompiler } from '@sinclair/typebox/compiler'
import { dd } from '~/util'

import type { Static, TSchema } from '@sinclair/typebox'
import type { CompletionUsage } from 'ai'
import type { Pushable } from 'it-pushable'
import type { ContextValue } from '~/context'
import type { Runtime } from '~/runtime/runtime'

export function defineAction<T extends TSchema>(options: ActionOptions<T>): Action<Static<T>> {
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

export interface Action<T = any> {
  name: ActionName;
  execute: ActionHandler<T>
  validate: (props: T) => void;
}

export interface ActionOptions<T extends TSchema> {
  name: ActionName;
  schema: T;
  execute: ActionHandler<Static<T>>;
  validate?: (props: Static<T>) => void;
}

export interface ActionResult {
  name: ActionName;
  contextName: string;
  input: ContextValue;
  output: ContextValue;
  usage?: CompletionUsage;
}

export interface ActionContext<T> {
  props: T;
  runtime: Runtime;
  stream?: Pushable<string>;
}

export type ActionName = string

export type ActionHandler<T> = (
  ctx: ActionContext<T>,
  input: ContextValue,
  prevResults: ActionResult[],
) => ContextValue | PromiseLike<ContextValue>
