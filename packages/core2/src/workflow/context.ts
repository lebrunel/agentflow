export type ContextName = string

export type ContextTypeMap = Record<ContextName, ContextType>

export type ContextValueMap = Record<ContextName, ContextValue>

export type ContextType = 'text' | 'image'

export type ContextValue =
  | ContextTextValue
  | ContextImageValue

export type ContextTextValue = {
  type: 'text',
  text: string,
}

export type ContextImageValue = {
  type: 'image',
  image: {
    name: string,
    type: string,
    data: string,
  }
}
