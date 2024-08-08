export interface ContextInput {
  name: string;
  description?: string;
  type: ContextType;
}



export type ContextMap2 = Map<ContextName, ContextType>

export type ContextName = string
export type ContextType = 'text' | 'image'
export type ContextMap = Map<ContextName, ContextValue>

export type ContextValue = ContextTextValue | ContextImageValue

type ContextTextValue = {
  type: 'text',
  text: string,
}

type ContextImageValue = {
  type: 'image',
  image: { type: string, encoding: ContextImageEncoding, data: string },
}

type ContextImageEncoding = 'base64'