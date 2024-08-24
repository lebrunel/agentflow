export function contextType(val: any): ContextType {
  switch (typeof val) {
    case 'string': return 'text'
    case 'object': return 'image'
    default:
      throw new Error('Unrecognised value type')
  }
}

export type ContextName = string

export type ContextTypeMap = Record<ContextName, ContextType>

export type ContextValueMap = Record<ContextName, ContextValue>

export type ContextType = 'text' | 'image'

export type ContextValue =
  | ContextTextValue
  | ContextImageValue

export type ContextTextValue = {
  type: 'text',
  value: string,
}

export type ContextImageValue = {
  type: 'image',
  value: {
    name: string,
    type: string,
    data: Uint8Array,
  }
}
