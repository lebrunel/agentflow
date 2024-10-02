import { afterAll, beforeAll, expect, test } from 'bun:test'
import { spawn } from 'bun'
import { resolve, join } from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import fg from 'fast-glob'

const cliPath = resolve(__dirname, '..', 'src', 'index.ts')
let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'agentflow-test-'))
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function run(args: string[] = []) {
  const proc = spawn({
    cmd: ['bun', 'run', cliPath, ...args],
    cwd: tmpDir,
    stdin: 'pipe',
    stdout: 'pipe'
  })

  const stdout = (async function* () {
    for await (const chunk of proc.stdout as AsyncReadable) {
      yield Buffer.from(chunk).toString()
    }
  })()

  return {
    stdout,
    stdin: proc.stdin,

    kill: () => proc.kill(),
    next: async () => {
      const { value } = await stdout.next()
      return value
    },
    write: (data: string) => {
      proc.stdin.write(data)
      proc.stdin.flush()
    }
  }
}

test('prompts for the project name (with default)', async () => {
  const proc = run()
  const text = await proc.next()
  expect(text).toContain('Project name:')
  expect(text).toContain('(agentflow-project)')
  proc.kill()
})

test('prompts for the project name (using given name)', async () => {
  const proc = run(['foo-bar'])
  const text = await proc.next()
  expect(text).toContain('Project name:')
  expect(text).toContain('(foo-bar)')
  proc.kill()
})

test('prompts for confirmation to overwrite if folder exists', async () => {
  fs.mkdirSync(join(tmpDir, 'already-exists'))
  fs.writeFileSync(join(tmpDir, 'already-exists', 'test.txt'), 'testing')

  const proc = run(['already-exists'])
  await proc.next()
  proc.write('\r')

  // Little hack to keep pulling from stdout until the test passes
  let text: string = ''
  while (true) {
    text += await proc.next() || ''
    if (/not empty/.test(text)) break
  }

  expect(text).toContain('Target directory is not empty. Remove existing files and continue?')
  proc.kill()
})

test('generates project from template', async () => {
  const proc = run(['foo-bar'])
  await proc.next()
  proc.write('\r')

  let text: string = ''
  for await (const line of proc.stdout) {
    text += line
  }

  expect(text).toContain('Done. Now run:')
  expect(text).toContain('cd foo-bar')
  expect(text).toContain('npm i')

  const files = fg.globSync('**/*', {
    cwd: join(tmpDir, 'foo-bar'),
    dot: true,
  })

  expect(files).toContain('.gitignore')
  expect(files).toContain('.env')
  expect(files).toContain('agentflow.config.js')
  expect(files).toContain('package.json')
  expect(files).toContain('flows/hello-world.mdx')
  proc.kill()
})

// Utility types

type AsyncReadable = AsyncIterable<Uint8Array> & ReadableStream<Uint8Array>
