import { z } from 'zod'
import { type CoreTool} from 'ai'

export function defineTool<T extends z.ZodType>(options: Tool<T>): Tool<T>
export function defineTool<T extends z.ZodType>(name: string, options: CoreTool<T>): Tool<T>
export function defineTool<T extends z.ZodType>(nameOrOpts: Tool<T> | string, tool?: CoreTool<T> ): Tool<T> {
  if (typeof nameOrOpts === 'string') {
    if (
      typeof tool !== 'object' ||
      !['description', 'parameters', 'execute'].every(key => key in tool)
    ) {
      throw new Error('Invalid CoreTool type: ${tool}')
    }
    const { description, parameters, execute } = tool
    return {
      name: nameOrOpts,
      description: description!,
      params: parameters,
      invoke: execute!
    }
  } else {
    return { ...nameOrOpts }
  }
}

// Types

export interface Tool<T extends z.ZodType = z.ZodType> {
  name: ToolName;
  description: string;
  params: T;
  invoke: ToolFn<z.infer<T>>;
}

export type ToolOptions<T extends z.ZodType> = Tool<T> | (CoreTool<T> & {
  name: ToolName;
})

export type ToolName = string

export type ToolFn<T> = (input: T) => PromiseLike<any>
