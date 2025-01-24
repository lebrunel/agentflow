import { FRAGMENT_SYMBOL } from './types'
import type { ContextValue, ContextValueMap, Fragment } from './types'

/**
 * TODO
 */
export function fromContextValue(ctx: ContextValue): ContextValue['value'] {
  return ctx.value
}

/**
 * TODO
 */
export function toContextValue(value: any): ContextValue {
  if (typeof value === 'symbol' && value.description === 'fail') {
    return { type: 'primitive', value: '!err' }
  }

  if (['string', 'number', 'boolean', 'null', 'undefined'].includes(typeof value)) {
    return { type: 'primitive', value: value as string | number | boolean | null | undefined }
  }

  if (value instanceof File) {
    return { type: 'file', value }
  }

  if (isFragment(value)) {
    return { type: 'primitive', value: value[1] }
  }

  if (Array.isArray(value) && value.every(isFragment)) {
    return { type: 'primitive', value: value.map(v => v[1]).join('\n') }
  }

  return { type: 'json', value }
}

/**
 * TODO
 */
export function unwrapContext(ctx: ContextValueMap): Record<string, ContextValue['value']> {
  return Object.entries(ctx).reduce((obj, [key, value]) => {
    obj[key] = fromContextValue(value)
    return obj
  }, {} as Record<string, ContextValue['value']>)
}

/**
 * TODO
 */
export function wrapContext(obj: Record<string, any>): ContextValueMap {
  return Object.entries(obj).reduce((ctx, [key, value]) => {
    ctx[key] = toContextValue(value)
    return ctx
  }, {} as ContextValueMap)
}

// Helpres

function isFragment(val: any): val is Fragment {
  return Array.isArray(val) && val[0] === FRAGMENT_SYMBOL && typeof val[1] === 'string'
}
