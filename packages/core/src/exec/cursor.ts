/**
 * Represents an immutable cursor for tracking the position in a workflow.
 *
 * This class provides methods for parsing and inspecting the current position
 * of execution within a workflow.
 *
 * The cursor is immutable, and new instances are created when using the static
 * "move", "push" and "pop" methods.
 */
export class ExecutionCursor {
  #cursor: CursorLocation[]
  #scope: CursorLocation[]
  #location: CursorLocation

  constructor(cursor: CursorLocation[] = [[0,0,0]]) {
    if (!cursor.length) {
      throw new Error('Cursor must contain at least one element.')
    }
    if (cursor.some(c => c.some(n => n < 0))) {
      throw new Error('Cursor cannot have negative indices.')
    }

    this.#cursor = cursor
    this.#scope = cursor.slice(0, -1)
    this.#location = cursor[cursor.length - 1]
  }

  /**
   * Moves the cursor sideways within the same scope.
   */
  static move(cursor: ExecutionCursor, location: CursorLocation): ExecutionCursor {
    return new ExecutionCursor([...cursor.scope, location])
  }

  /**
   * Pushes a new element onto the cursor stack, moving a level deeper.
   */
  static push(cursor: ExecutionCursor): ExecutionCursor {
    return new ExecutionCursor([...cursor.cursor, [0,0,0]])
  }

  /**
   * Removes the tail of the cursor stack, effectively moving up a level.
   */
  static pop(cursor: ExecutionCursor): ExecutionCursor {
    return new ExecutionCursor(cursor.scope)
  }

  /**
   * Parses a cursor path string and creates a new ExecutionCursor instance.
   *
   * The cursor path string should be in the format '/a.b.c/x.y.z',
   * where a, b, c, x, y, z are non-negative integers representing iteration,
   * phaseIndex, and actionIndex respectively.
   *
   * If the provided cursor path is invalid, an error is thrown.
   *
   * The resulting ExecutionCursor instance represents the position in the
   * workflow specified by the cursor path.
   */
  static parse(cursorPath: string): ExecutionCursor {
    if (!CURSOR_REGEX.test(cursorPath)) {
      throw new Error(`Invalid cursor: ${cursorPath}`)
    }

    const cursor = cursorPath
      .replace(/^\//, '')
      .split('/')
      .map(c => c.split('.').map(Number)) as CursorLocation[]

    return new ExecutionCursor(cursor)
  }

  /**
   * Returns a copy of the internal cursor array.
   */
  get cursor(): CursorLocation[] {
    return this.#cursor.map(c => [...c])
  }

  /**
   * Returns a copy of the internal cursor array, excluding the tail.
   */
  get scope(): CursorLocation[] {
    return this.#scope.map(c => [...c])
  }

  /**
   * Returns the full cursor path as a string, combining scope and location.
   * Format: '/a.b.c/x.y.z', where a, b, c, x, y, z are non-negative integers.
   */
  get path(): string {
    return '/' + this.#scope.map(c => c.join('.')).join('/')
  }

  /**
   * Returns the tail of the cursor as a string, representing the current
   * location within a specific scope.
   */
  get location(): string {
    return this.#location.join('.')
  }

  /**
   * Returns the current iteration count from the cursor's tail.
   */
  get iteration(): number {
    return this.#location[0]
  }

  /**
   * Returns the phase index of the current cursor position.
   */
  get phaseIndex(): number {
    return this.#location[1]
  }

  /**
   * Returns the current action index within the workflow phase.
   */
  get actionIndex(): number {
    return this.#location[2]
  }

  /**
   * Checks if this cursor is equal to another cursor.
   */
  eq(other: ExecutionCursor): boolean {
    return cursorCompare(this, other) === 0
  }

  /**
   * Checks if this cursor is greater than another cursor.
   */
  gt(other: ExecutionCursor): boolean {
    return cursorCompare(this, other) === 1
  }

  /**
   * Checks if this cursor is less than another cursor.
   */
  lt(other: ExecutionCursor): boolean {
    return cursorCompare(this, other) === -1
  }

  /**
   * Returns a string representation of the cursor.
   * Format: '/a.b.c/x.y.z', where a, b, c, x, y, z are non-negative integers.
   */
  toString(): string {
    return this.path + (this.#scope.length ? '/' : '') + this.location
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `<Cursor ${this.toString()}>`
  }
}

/**
 * Compares two ExecutionCursor instances and determines their relative order.
 * Returns -1 if cursorLeft is less than cursorRight, 0 if they are equal,
 * and 1 if cursorLeft is greater than cursorRight. The comparison is done
 * by iterating through the cursor arrays and comparing each cursor element.
 */
export function cursorCompare(
  cursorLeft: ExecutionCursor,
  cursorRight: ExecutionCursor,
): -1 | 0 | 1 {
  const left = cursorLeft.cursor
  const right = cursorRight.cursor
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

/**
 * Parses a cursor location string and returns an object with
 * iteration, phaseIndex, and actionIndex numbers. The location string should be
 * in the format 'a.b.c', where a, b, and c are non-negative integers.
 */
export function parseLocation(location: string) {
  const indices = location.split('.').map(Number)
  if (indices.length !== 3 || indices.some(isNaN) || indices.some(n => n < 0)) {
    throw new Error(`Invalid cursor location: ${location}`)
  }

  return {
    iteration: indices[0],
    phaseIndex: indices[1],
    actionIndex: indices[2],
  }
}

// Matches a cursor path string
const CURSOR_REGEX = /^(\/\d+\.\d+\.\d+)+$/

/**
 * Represents a cursor location in a workflow execution.
 * It contains three elements: iteration count, phase index, and action index.
 */
export type CursorLocation = [
  iteration: number,
  phaseIndex: number,
  actionIndex: number,
]
