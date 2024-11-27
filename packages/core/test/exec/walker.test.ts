import { describe, expect, test } from 'bun:test'
import dd from 'ts-dedent'
import { env } from 'test/support/env'

import { ExecutionCursor, ExecutionWalker } from 'src/exec'
import { Workflow } from 'src/workflow'

const workflow = Workflow.compileSync(dd`
Foo

<Mock as="a" value="aaa" />

Bar

---

<Loop as="b" until={$.index === 3}>
  Baz
</Loop>
`, { env })
const walker = new ExecutionWalker(workflow)

describe('ExecutionWalker', () => {
  test('findScope() finds WorkflowScope by cursor', () => {
    const scope1 = walker.findScope(ExecutionCursor.parse('/0.0.0'))
    const scope2 = walker.findScope(ExecutionCursor.parse('/0.1.0/0.0.0'))
    expect(scope1?.phases).toHaveLength(2)
    expect(scope2?.phases).toHaveLength(1)
  })

  test('findScope() returns undefined for invalid cursor', () => {
    const scope = walker.findScope(ExecutionCursor.parse('/999.999.999/0.0.0'))
    expect(scope).toBeUndefined()
  })

  test('findPhase() finds WorkflowPhase by cursor', () => {
    const phase1 = walker.findPhase(ExecutionCursor.parse('/0.0.0'))
    const phase2 = walker.findPhase(ExecutionCursor.parse('/0.1.0/0.0.0'))
    expect(phase1?.steps).toHaveLength(2)
    expect(phase2?.steps).toHaveLength(1)
  })

  test('findPhase() returns undefined for invalid cursor', () => {
    const phase = walker.findPhase(ExecutionCursor.parse('/999.999.999'))
    expect(phase).toBeUndefined()
  })

  test('findStep() finds WorkflowStep by cursor', () => {
    const step1 = walker.findStep(ExecutionCursor.parse('/0.0.0'))
    const step2 = walker.findStep(ExecutionCursor.parse('/0.1.0'))
    const step3 = walker.findStep(ExecutionCursor.parse('/0.1.0/0.0.0'))
    expect(step1?.action?.name).toBe('mock')
    expect(step2?.action?.name).toBe('loop')
    expect(step2?.childScope).toBeTruthy()
    expect(step3?.action).toBeUndefined()
  })

  test('findStep() returns undefined for invalid cursor', () => {
    const step = walker.findStep(ExecutionCursor.parse('/999.999.999'))
    expect(step).toBeUndefined()
  })

  describe('.assert', () => {
    test('findScope() finds WorkflowScope by cursor', () => {
      const scope = walker.assert.findScope(ExecutionCursor.parse('/0.0.0'))
      expect(scope).toBeTruthy()
    })

    test('findScope() throws for invalid cursor', () => {
      expect(() => {
        walker.assert.findScope(ExecutionCursor.parse('/999.999.999/0.0.0'))
      }).toThrow(/scope not found/i)
    })

    test('findPhase() finds WorkflowPhase by cursor', () => {
      const phase = walker.assert.findPhase(ExecutionCursor.parse('/0.0.0'))
      expect(phase).toBeTruthy()
    })

    test('findPhase() throws for invalid cursor', () => {
      expect(() => {
        walker.assert.findPhase(ExecutionCursor.parse('/999.999.999'))
      }).toThrow(/phase not found/i)
    })

    test('findStep() finds WorkflowStep by cursor', () => {
      const step = walker.assert.findStep(ExecutionCursor.parse('/0.0.0'))
      expect(step).toBeTruthy()
    })

    test('findStep() throws for invalid cursor', () => {
      expect(() => {
        walker.assert.findStep(ExecutionCursor.parse('/999.999.999'))
      }).toThrow(/step not found/i)
    })
  })

  //describe('advanceCursor()', () => {
  //  test('icrements step if not last step', () => {
  //    const next = walker.advanceCursor(ExecutionCursor.parse('/0.0.0'))
  //    expect(next.toString()).toBe('/0.0.1')
  //  })

  //  test('icrements phase if not last phase', () => {
  //    const next = walker.advanceCursor(ExecutionCursor.parse('/0.0.1'))
  //    expect(next.toString()).toBe('/0.1.0')
  //  })

  //  test('icrements iteration if last step in loop', () => {
  //    const next = walker.advanceCursor(ExecutionCursor.parse('/0.1.0/0.0.0'))
  //    expect(next.toString()).toBe('/0.1.0/1.0.0')
  //  })

  //  test.todo('otherwise returns the same cursor', () => {
  //    // not sure if this should return the same cursor ... ?
  //    // maybe would be best to raise an error
  //  })
  //})
})
