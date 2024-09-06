import { describe, expect, test } from 'bun:test'
import { ExecutionCursor } from '~/runtime'

describe('ExecutionCursor', () => {
  const cursor1 = ExecutionCursor.parse('/0.0.1')
  const cursor2 = ExecutionCursor.parse('/0.0.1/0.0.2/0.0.0')

  test('by default initates with zero indexed root cursor', () => {
    const cursor = new ExecutionCursor()
    expect(cursor.path).toBe('/')
    expect(cursor.location).toBe('0.0.0')
  })

  test('path and key properties', () => {
    expect(cursor1.path).toBe('/')
    expect(cursor1.location).toBe('0.0.1')
    expect(cursor2.path).toBe('/0.0.1/0.0.2')
    expect(cursor2.location).toBe('0.0.0')
  })

  test('iteration, phase and action indicies', () => {
    expect(cursor1.iteration).toBe(0)
    expect(cursor1.phaseIndex).toBe(0)
    expect(cursor1.actionIndex).toBe(1)
    expect(cursor2.iteration).toBe(0)
    expect(cursor2.phaseIndex).toBe(0)
    expect(cursor2.actionIndex).toBe(0)
  })

  test('toString() returns original string', () => {
    expect(cursor1.toString()).toBe('/0.0.1')
    expect(cursor2.toString()).toBe('/0.0.1/0.0.2/0.0.0')
  })
})

describe('ExecutionCursor.parse()', () => {
  test('parses a valid cursor string', () => {
    expect(ExecutionCursor.parse('/0.0.1')).toBeInstanceOf(ExecutionCursor)
    expect(ExecutionCursor.parse('/0.0.1/0.0.1')).toBeInstanceOf(ExecutionCursor)
    expect(ExecutionCursor.parse('/0.0.1/2555.2555.2555/0.0.0')).toBeInstanceOf(ExecutionCursor)
  })

  test('throws for invalid cursor string', () => {
    expect(() => ExecutionCursor.parse('/')).toThrow(/invalid cursor/i)
    expect(() => ExecutionCursor.parse('/0.0.1/0')).toThrow()
    expect(() => ExecutionCursor.parse('not a cursor')).toThrow()
  })
})

describe('ExecutionCursor.move()', () => {
  const start = ExecutionCursor.parse('/0.0.1/0.0.5')

  test('returns a new instance with adjusted tail', () => {
    const cursor1 = ExecutionCursor.move(start, [0,0,0])
    const cursor2 = ExecutionCursor.move(start, [99,0,5])
    expect(cursor1.toString()).toBe('/0.0.1/0.0.0')
    expect(cursor2.toString()).toBe('/0.0.1/99.0.5')
  })
})

describe('ExecutionCursor.push()', () => {
  const start = ExecutionCursor.parse('/0.0.1/0.0.5')

  test('returns a new instance with new zero indexed tail', () => {
    const cursor = ExecutionCursor.push(start)
    expect(cursor.toString()).toBe('/0.0.1/0.0.5/0.0.0')
  })
})

describe('ExecutionCursor.pop()', () => {
  const start = ExecutionCursor.parse('/0.0.1/0.0.5')

  test('returns a new instance with tail removed', () => {
    const cursor = ExecutionCursor.pop(start)
    expect(cursor.toString()).toBe('/0.0.1')
  })
})
