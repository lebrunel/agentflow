/**
 * TODO
 */
export function compareCursors(
  left: ExecutionCursor,
  right: ExecutionCursor,
): -1 | 0 | 1 {
  const minLength = Math.min(left.length, right.length)

  for (let i = 0; i < minLength; i++) {
    const tupleL = left[i]
    const tupleR = right[i]

    for (let j = 0; j < 3; j++) {
      if (tupleL[j] < tupleR[j]) {
        return -1; // left is less than right
      } else if (tupleL[j] > tupleR[j]) {
        return 1;  // left is greater than right
      }
    }
  }

  // If we've reached here, all compared tuples are equal
  // // left is less than right because it has fewer tuples
  if (left.length < right.length) {
    return -1

  // left is greater than right because it has more tuples
  } else if (left.length > right.length) {
    return 1

  // cursors are equal
  } else {
    return 0
  }
}

export function parseCursor(position: Position): ExecutionCursor {
  const cursor = position.replace(/^\//, '').split('/')
    .map(chunk => chunk.split('.').map(n => Number(n)))

  const isValidCursor = cursor.every(indices => {
    return indices.length === 3 &&
           indices.every(n => typeof n === 'number' && n >= 0)
  })

  if (!isValidCursor) {
    throw new Error(`Error parsing cursor: ${position}`)
  }

  return cursor as ExecutionCursor
}

/**
 * TODO
 */
export function stringifyCursor(
  cursor: ExecutionCursor,
  dropTail: boolean = false
): Position {
  if (dropTail) cursor = cursor.slice(0, -1)
  return '/' + cursor.map(c => c.join('.')).join('/')
}

export type ExecutionCursor = Cursor[]

export type Cursor = [
  iterationCount: number,
  phaseIndex: number,
  actionIndex: number,
]

export type Position = string
