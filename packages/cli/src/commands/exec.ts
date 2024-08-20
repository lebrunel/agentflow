import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Command } from 'commander'
import { blue, bold, dim } from 'picocolors'
import { compileWorkflow, executeWorkflow, util, Runtime } from '@ada/core'
import type { UserConfig } from '@ada/core'

import { resolveConfig } from '../config'
import { promptInputs } from '../prompts'

const cmd = new Command()
  .name('exec')
  .alias('x')
  .description('executes the given workflow')
  .argument('<workflow>', 'name of the workflow')
  .action(execWorkflow)

async function execWorkflow(name: string) {
  const cwd = process.cwd()
  const config = await resolveConfig(cwd)
  const runtime = new Runtime(config as UserConfig)
  const flowName = name.trim().replace(/(.md)?$/, '.md')
  const flowPath = join(cwd, config.paths.flows, flowName)
  const flowStr = readFileSync(flowPath, { encoding: 'utf8' })

  const workflow = compileWorkflow(flowStr, runtime)

  console.log(`🚀 ${bold(workflow.title)}`)
  console.log()
  //console.log(workflow.description)
  //console.log()

  const context = await promptInputs(workflow.inputs)
  console.log()
  const ctrl = executeWorkflow(workflow, context, runtime)

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
      const outputDir = ensureOutputDir(join(cwd, config.paths.outputs), now)
      const outputName = generateOutputName(flowName, now)
      const outputPath = join(outputDir, outputName)
      const content = appendFrontmatter(workflow.title, now, result)
      writeFileSync(outputPath, content, { encoding: 'utf8' })
      // todo - print token stats/costs and add to output metadata
      resolve()
    })
  })
}

function appendFrontmatter(title: string, created: Date, body: string) {
  return util.dd`
  ---
  title: ${title}
  created: ${created.toISOString()}
  ---

  ${body}
  `
}

function ensureOutputDir(outputsDir: string, created: Date) {
  const date = created.toISOString().slice(2, 10).replace(/-/g, '')
  const dirName = join(outputsDir, date)
  if (!existsSync(dirName)) mkdirSync(dirName, { recursive: true })
  return dirName
}

function generateOutputName(fileName: string, created: Date): string {
  const daySeconds = (created.getHours() * 3600) + (created.getMinutes() * 60) + created.getSeconds()
  const slug = daySeconds.toString(36).padStart(4, '0')
  return `${slug}-${fileName}`
}


export default cmd

