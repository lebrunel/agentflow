import { expect, test, describe } from 'bun:test'
import { parse } from 'acorn'
import { u } from 'unist-builder'
import { getExpressionDependencies } from 'src/exec'

import type { ExpressionNode } from 'src/ast'

describe('getExpressionDependencies', () => {
  function testExpression(expr: string, expected: string[]) {
    const node = u('expression', {
      expressionType: 'flow',
      data: { estree: parse(expr, { ecmaVersion: 'latest' }) },
      value: expr,
    }) as ExpressionNode
    const dependencies = getExpressionDependencies(node)
    expect(new Set(dependencies)).toEqual(new Set(expected))
  }

  test('simple global variables', () => {
    testExpression('x + y', ['x', 'y'])
  })

  test('function call with global variables', () => {
    testExpression('foo(x, y)', ['foo', 'x', 'y'])
  })

  test('nested object and array access', () => {
    testExpression('a.b[c].d', ['a', 'c'])
  })

  test('function parameters are not included', () => {
    testExpression('((x, y) => x + y + z)()', ['z'])
  })

  test('arrow function with various parameter types', () => {
    testExpression(`
      (
        a,
        {b, c},
        [d, e],
        ...f
      ) => a + b + c + d + e + f.length + g
    `, ['g']);
  })

  test('function expression with name is not included', () => {
    testExpression('(function foo(x) { return x + y; })()', ['y'])
  })

  test('variable declarations are not included', () => {
    testExpression(`
      let a = 1;
      var b = 2;
      const c = 3;
      a + b + c + d
    `, ['d'])
  })

  test('complex destructuring in variable declarations', () => {
    testExpression(`
      let {a, b: [c, ...d]} = obj;
      const {e: {f = defaultF}} = anotherObj;
      a + b + c + d + e + f + defaultF + obj + anotherObj + g
    `, ['obj', 'defaultF', 'anotherObj', 'g'])
  })

  test('nested functions', () => {
    testExpression(`
      (function outer(a) {
        return function inner(b) {
          return a + b + c;
        };
      })()
    `, ['c'])
  })

  test('complex real-world scenario', () => {
    testExpression(`
      const data = fetchData();
      const {results = [], meta: {page = 1, totalPages} = {}} = data;

      results.map(({id, name}) => ({
        id,
        displayName: formatName(name),
        status: getStatus(id)
      })).filter(item => item.status === 'active')
        .forEach(console.log);

      updatePagination(page, totalPages);
    `, ['fetchData', 'formatName', 'getStatus', 'console', 'updatePagination'])
  })

  test('tagged template literals', () => {
    testExpression(`
      const dd = (strings, ...values) => strings[0] + values[0];
      dd\`Hello \${world}\`;
    `, ['world'])
  })

  test('object and array destructuring in parameters', () => {
    testExpression(`
      (({a, b}, [c, d]) => {
        return a + b + c + d + e;
      })()
    `, ['e'])
  })

  test('nested destructuring', () => {
    testExpression(`
      (function complex({a: {b: [c, ...d]}, e: f = defaultValue}) {
        return a + b + c + d + e + f + defaultValue + g;
      })()
    `, ['defaultValue', 'g'])
  })

  test('destructuring in various contexts', () => {
    testExpression(`
      const {a, b} = obj1;
      let [c, d] = arr1;
      ({e, f} = obj2);
      [g, h] = arr2;
      (function func({i}, [j]) {
        return a + b + c + d + e + f + g + h + i + j + k;
      })()
    `, ['obj1', 'arr1', 'obj2', 'arr2', 'k'])
  })

  test('nested destructuring with default values', () => {
    testExpression(`
      (function complex({a: {b: [c = defaultC, ...d] = defaultArray} = defaultObj, e: f = defaultF} = {}) {
        return a + b + c + d + e + f + defaultC + defaultArray + defaultObj + defaultF + g;
      })()
    `, ['defaultC', 'defaultArray', 'defaultObj', 'defaultF', 'g'])
  })

  test('destructuring in various contexts with default values', () => {
    testExpression(`
      const {a = defaultA, b: {c = defaultC} = defaultB} = obj1;
      let [d = defaultD, ...e] = arr1;
      ({f: g = defaultG} = obj2);
      [h = defaultH, i] = arr2;
      (function func({j = defaultJ}, [k = defaultK]) {
        return a + b + c + d + e + g + h + i + j + k + l;
      })()
    `, ['defaultA', 'defaultC', 'defaultB', 'obj1', 'defaultD', 'arr1', 'obj2', 'defaultG', 'arr2', 'defaultH', 'defaultJ', 'defaultK', 'l'])
  })
})
