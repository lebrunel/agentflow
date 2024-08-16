import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Command } from 'commander'
import { blue, bold, dim } from 'picocolors'
import { compileWorkflow, executeWorkflow, ExecutionStatus, Runtime } from '@ada/core'
import { resolveConfig } from '../config'

import type { UserConfig } from '@ada/core'
import { dd } from '../../../core/src/util'

const cmd = new Command()
  .name('exec')
  .alias('x')
  .description('executes the given workflow')
  .argument('<workflow>', 'name of the workflow')
  .option('--foo', 'xxxx')
  .action(execWorkflow)

async function execWorkflow(name: string) {
  const cwd = process.cwd()
  const config = await resolveConfig(cwd)
  const runtime = new Runtime(config as UserConfig)
  const flowName = name.trim().replace(/(.md)?$/, '.md')
  const flowPath = join(cwd, config.paths.flows, flowName)
  const flowStr = readFileSync(flowPath, { encoding: 'utf8' })

  const workflow = compileWorkflow(flowStr, runtime)
  const ctrl = executeWorkflow(workflow, {
    name: { type: 'text', text: 'Bob' },
    style: { type: 'text', text: 'Raggae' }
  }, runtime)

  console.log(`🚀 ${bold(workflow.title)}`)
  console.log()
  

  ctrl.on('action', async ({ action, stream, input, result }) => {
    console.log(dim('[['), `${blue(action.type)}@${blue(action.name)}`, dim(']]'))
    console.log()
    console.log(dim(input))
    console.log()

    let isStreaming = false
    
    result.then((result) => {
      if (isStreaming) {
        process.stdout.write('\n')
      } else {
        console.log(result.output.text)
      }
      // either way, end the stream
      stream.end()
      console.log()
    })

    for await (const chunk of stream) {
      isStreaming = true
      process.stdout.write(chunk)
    }
  })

  //ctrl.on('action.start', action => {
  //  console.log(action.type)
  //})
  //
  //ctrl.on('action.complete', result => {
  //  console.log(result)
  //})

  ctrl.on('error', (err) => {
    console.error(err)
  })

  return new Promise<void>(resolve => {
    ctrl.on('complete', (result) => {
      const now = new Date()
      const outputName = `${generatePrefix(now)}-${flowName}`
      const outputPath = join(cwd, config.paths.outputs, outputName)
      const content = appendFrontmatter(workflow.title, now, result)
      writeFileSync(outputPath, content, { encoding: 'utf8' })
      // todo - print token stats/costs and add to output metadata
      resolve()
    })
  })
}

function appendFrontmatter(title: string, created: Date, body: string) {
  return dd`
  ---
  title: ${title}
  created: ${created.toISOString()}
  ---

  ${body}
  `
}

function generatePrefix(created: Date): string {
  const datePrefix = created.toISOString().slice(2, 8).replace(/-/g, '')
  const daySeconds = (created.getHours() * 3600) + (created.getMinutes() * 60) + created.getSeconds()
  const slug = daySeconds.toString(36).padStart(4, '0')
  return `${datePrefix}-${slug}`
}


export default cmd

