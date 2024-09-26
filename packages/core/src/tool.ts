import { z } from 'zod'
import { tool, type CoreTool } from 'ai'

export function defineTool<T extends z.ZodType>(options: ToolOptions<T>): Tool<T> {
  return { ...options }
}

export function toCoreTool<T extends z.ZodType>(options: Tool<T>): CoreTool<T> {
  const { description, params: parameters, invoke: execute } = options
  return tool({ description, parameters, execute })
}

export interface Tool<T extends z.ZodType = z.ZodType> {
  name: ToolName;
  description: string;
  params: T;
  invoke: ToolFn<z.infer<T>>;
}

export type ToolOptions<T extends z.ZodType> = Tool<T>

export type ToolName = string

export type ToolFn<T> = (input: T) => Promise<any>
