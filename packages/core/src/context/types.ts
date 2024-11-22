export type ContextKey = string

export type Context = Record<ContextKey, any>

export type ContextValueMap = Record<ContextKey, ContextValue>

export type ContextValue =
  | PrimitiveContextValue
  | FileContextValue
  | JsonContextValue

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

type JsonPrimitive = string | number | boolean | null
type JsonArray = Array<JsonValue>
type JsonObject = { [key: string]: JsonValue }
type JsonValue = JsonPrimitive | JsonArray | JsonObject
