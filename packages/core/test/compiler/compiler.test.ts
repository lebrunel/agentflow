import { describe, expect, test } from 'bun:test'
import { runtime } from 'test/support/runtime'
import { VFile } from 'vfile'

import { compile, compileSync, createProcessor, Workflow } from 'src/index'

describe('compile()', () => {
  test('returns a promise that resolves to a WorkflowFile', () => {
    const fileP = compile('testing')
    expect(fileP).toBeInstanceOf(Promise)
    expect(fileP).resolves.toBeInstanceOf(VFile)
  })

  test('returns a promise that rejects if the src is invalid', () => {
    const fileP = compile('<Inavlid />', { runtime })
    expect(fileP).toBeInstanceOf(Promise)
    expect(fileP).rejects.toThrow()
  })
})

describe('compileSync()', () => {
  test('returns a WorkflowFile', () => {
    expect(compileSync('testing')).toBeInstanceOf(VFile)
  })

  test('throws an error is the src is invalid', () => {
    expect(() => compileSync('<Inavlid />', { runtime })).toThrow()
  })

  test('passing the runtime option adds extra validations', () => {
    expect(() => compileSync('<Inavlid />')).not.toThrow()
    expect(() => compileSync('<Inavlid />', { runtime })).toThrow()
  })

  test('WorkflowFile.result is a Workflow', () => {
    const file = compileSync('testing')
    expect(file.result).toBeInstanceOf(Workflow)
  })

  test('WorkflowFile.messages is an array of diagnostics', () => {
    const file = compileSync('testing')
    expect(file.messages).toBeArray()
    file.message('foo bar')
    expect(file.messages[0].message).toEqual('foo bar')
  })
})

describe('createProcessor()', () => {
  test('returns a unified Processor', () => {
    const proc = createProcessor()
    expect(proc.parse).toBeTypeOf('function')
    expect(proc.run).toBeTypeOf('function')
    expect(proc.process).toBeTypeOf('function')
  })
})
