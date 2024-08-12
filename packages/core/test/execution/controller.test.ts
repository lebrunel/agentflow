import { describe, expect, test } from 'bun:test'
import { Workflow } from '../../src/workflow'
import { ExecutionController } from '../../src/execution/controller'
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
  const controller = new ExecutionController(workflow, {})

  queueMicrotask(() => controller.runAll())

  controller.on('error', error => { throw error })

  controller.on('phase', phase => {
    console.log('PHASE')
  })

  controller.on('action.start', async action => {
    console.log('ACTION')
    if (action.stream) {
      for await (const text of action.stream) {
        process.stdout.write(text)
      }
      console.log('\n---')
    }
  })

  controller.on('complete', (result) => {
    console.log('COMPLETE')
    console.log(result)
    done()
  })

})