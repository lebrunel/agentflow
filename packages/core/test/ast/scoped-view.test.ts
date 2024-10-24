import { describe, expect, test } from 'bun:test'
import dd from 'ts-dedent'
import { createCompiler, createScopedView, walkScopeTree } from 'src/ast'
import type { WorkflowScope } from 'src/ast'

function tree(src: string): WorkflowScope {
  const proc = createCompiler()
  const ast = proc.runSync(proc.parse(src))
  return createScopedView(ast.children)
}

describe('createScopedView()', () => {
  test('accepts single phase', () => {
    const scope = tree(dd`
    Hello
    `)

    expect(scope.phases).toHaveLength(1)
  })

  test('accepts multiple phases', () => {
    const scope = tree(dd`
    Hello

    ---

    World
    `)

    expect(scope.phases).toHaveLength(2)
  })

  test('handles multiple phase dividers', () => {
    const scope = tree(dd`
    Hello

    ---
    ---
    ---

    World
    `)

    expect(scope.phases).toHaveLength(2)
  })

  test('accepts nested scopes', () => {
    const scope = tree(dd`
    <Loop as="loop" until={$.index === 2}>
      Hello

      <Cond as="cond" if={true}>
        World
      </Cond>
    </Loop>
    `)

    // root scope
    expect(scope.phases).toHaveLength(1)
    expect(scope.phases[0].steps).toHaveLength(1)
    // 1st scope
    expect(scope.phases[0].steps[0].childScope?.phases).toHaveLength(1)
    expect(scope.phases[0].steps[0].childScope?.phases[0].steps).toHaveLength(1)
    // 2nd scope
    expect(scope.phases[0].steps[0].childScope?.phases[0].steps[0].childScope?.phases).toHaveLength(1)
  })

  test('accepts nested scopes with sub-phases', () => {
    const scope = tree(dd`
    <Loop as="loop" until={$.index === 2}>
      Hello

      ---

      World
    </Loop>
    `)

    // root scope
    expect(scope.phases).toHaveLength(1)
    expect(scope.phases[0].steps).toHaveLength(1)
    // 1st scope
    expect(scope.phases[0].steps[0].childScope?.phases).toHaveLength(2)
  })

  test('accepts steps within phases', () => {
    const scope = tree(dd`
    World {foo}

    <Mock as="bar" value={'b'} />
    `)

    expect(scope.phases[0].steps).toHaveLength(1)
    expect(scope.phases[0].steps[0].content).toBeTruthy()
    expect(scope.phases[0].steps[0].expressions).toHaveLength(1)
    expect(scope.phases[0].steps[0].action).toBeTruthy()
    expect(scope.phases[0].steps[0].childScope).toBeUndefined()
  })
})

describe('walkScopeTree()', () => {
  test('iterates over every scope, phase and action in order', () => {
    const scope = tree(`
    ---
    data:
      name: Joe
    ---
    Hello {name}

    <Mock as="foo" value="a" />

    <Loop as="bar" until={$.index === 3} scope={{ baz: foo }}>
      Hello {baz}

      <Mock as="qux" value="a" />
    </Loop>
    `)

    expect.assertions(2 + 2 + 3)

    walkScopeTree(scope, {
      onScope(scope) {
        expect(scope.phases).toHaveLength(1)
        const path = scope.parentNode ? scope.parentNode.attributes.as : 'root'
        return { path }
      },

      onPhase(phase, context) {
        expect(phase.steps).toHaveLength(context.path === 'root' ? 2 : 1)
      },

      onStep(step, context) {
        switch(step.action?.attributes.as) {
          case 'foo':
            expect(context.path).toBe('root')
            break
          case 'bar':
            expect(context.path).toBe('root')
            break
          case 'qux':
            expect(context.path).toBe('bar')
            break
        }
      }
    })
  })
})
