export type ContextKey = string

export type ContextTypeMap = Record<ContextKey, ContextType>

export type ContextValueMap = Record<ContextKey, ContextValue>

export type ContextType = 'text' | 'image'

export type ContextValue =
  | ContextTextValue
  | ContextImageValue
  | ContextJSONValue

export type ContextTextValue = {
  type: 'text',
  value: string,
}

export type ContextImageValue = {
  type: 'image',
  value: {
    name: string,
    type: string,
    data: ArrayBuffer,
  }
}

export type ContextJSONValue = {
  type: 'json',
  value: any,
}
