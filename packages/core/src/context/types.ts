export type ContextKey = string

export type ContextValueMap = Record<ContextKey, ContextValue>

export type ContextValue =
  | PrimitiveContextValue
  | FileContextValue
  | JsonContextValue
  //| ComputedContextValue

export type PrimitiveContextValue = {
  type: 'primitive',
  value: string | number | boolean | null | undefined
}

export type FileContextValue ={
  type: 'file',
  value: File,
}

export type JsonContextValue = {
  type: 'json',
  value: JsonValue,
}

export type ComputedContextValue<T = any> = {
  type: 'magic',
  value: () => T,
}

type JsonPrimitive = string | number | boolean | null
type JsonArray = Array<JsonValue>
type JsonObject = { [key: string]: JsonValue }
type JsonValue = JsonPrimitive | JsonArray | JsonObject

export type ComputedContext = {
  [name: string]: () => JsonContextValue['value'],
}
