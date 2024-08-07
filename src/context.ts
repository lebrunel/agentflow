export interface ContextInput {
  name: string;
  description?: string;
  type: ContextType;
}

export type ContextName = string

export type ContextMap = Map<string, ContextType>

export type ContextType = 'string' | 'text' | 'image'

