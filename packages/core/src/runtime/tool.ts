import { z } from 'zod'
import { tool, type CoreTool } from 'ai'

export function defineTool<T extends z.ZodType>(options: ToolDef<T>): ToolDef<T> {
  return {...options}
}

export function toCoreTool<T extends z.ZodType>(toolDef: ToolDef<T>): CoreTool<T> {
  const { description, params: parameters, invoke: execute } = toolDef
  return tool({ description, parameters, execute })
}

export interface ToolDef<T extends z.ZodType> {
  name: ToolName;
  description: string;
  params: T;
  invoke: ToolFn<z.infer<T>>;
}

export type ToolName = string

export type ToolFn<T> = (input: T) => any | PromiseLike<any>
