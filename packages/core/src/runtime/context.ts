export function contextToString(ctx: ContextValue | ContextValue[]): string {
  if (Array.isArray(ctx)) {
    return ctx.map(contextToString).join('\n\n')
  }

  switch(ctx.type) {
    case 'text':
      return ctx.text
    case 'image':
      // todo - implement digests for images - should probably be in the context value
      return '![IMAGE](todo-image-digest.png)'
    default:
      throw new Error(`Unrecognised context type: ${JSON.stringify(ctx)}`)
  }
}

// Types

export type ContextName = string

export type ContextType = 'text' | 'image'

export type ContextTypeMap = Record<ContextName, ContextType>

export type ContextValueMap = Record<ContextName, ContextValue>

export type ContextValue = ContextTextValue | ContextImageValue

export type ContextTextValue = {
  type: 'text',
  text: string,
}

export type ContextImageValue = {
  type: 'image',
  image: string;
  mimeType?: string;
  digest?: string;
}
