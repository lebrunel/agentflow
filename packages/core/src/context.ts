// Types

export type ContextName = string

export type ContextType = 'text' | 'image'

export type ContextTypeMap = Record<ContextName, ContextType>

export type ContextValueMap = Record<ContextName, ContextValue>

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