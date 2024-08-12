import { describe, expect, test } from 'bun:test'
import { Workflow } from '../../src/workflow'
import { ExecutionRunner } from '../../src/execution/runner'
import { dd } from '../../src/util'

test.skip('testing runner', (done) => {
  const src = dd`
  Paragraph

  ---

  Create a "hello world" haiku

  \`\`\`generate@foo1
  model: ollama:llama3.1
  \`\`\`

  Now translate it to spanish.

  \`\`\`generate@foo2
  model: ollama:llama3.1
  \`\`\`
  `

  const workflow = Workflow.parse(src)
  const runner = new ExecutionRunner(workflow, {})

  queueMicrotask(() => runner.runAll())

  runner.on('error', error => { throw error })

  runner.on('phase', phase => {
    console.log('PHASE')
  })

  runner.on('action.start', async action => {
    console.log('ACTION')
    if (action.stream) {
      for await (const text of action.stream) {
        process.stdout.write(text)
      }
      console.log('\n---')
    }
  })

  runner.on('complete', (result) => {
    console.log('COMPLETE')
    console.log(result)
    done()
  })

})