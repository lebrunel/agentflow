import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { Command } from 'commander'
import pc from 'picocolors'
import { dedent as dd } from 'ts-dedent'
import { stringify as stringifyYaml } from 'yaml'
import { Workflow, Environment } from '@agentflow/core'

import { resolveConfig } from '../config'
import { createExecutionPlugin, resolveInputs } from '../plugin'


const cmd = new Command()
  .name('exec')
  .alias('x')
  .description('executes the given workflow')
  .argument('<workflow>', 'name of the workflow')
  .action(execWorkflow)

async function execWorkflow(name: string) {
  const cwd = process.cwd()
  const now = new Date()

  const config = await resolveConfig(cwd)
  const flowName = basename(name, extname(name))
  const outputPath = buildOutputPath(flowName, now)

  config.plugins ||= []
  config.plugins.push(createExecutionPlugin({ outputPath }))

  const env = new Environment(config)
  const path = findPath(join(cwd, 'flows'), flowName)
  const src = readFileSync(path, { encoding: 'utf8' })
  const workflow = Workflow.compileSync(src, env)

  console.log(`🚀 ${pc.bold(workflow.title)}`)
  console.log()

  const context = await resolveInputs(workflow.meta)
  console.log()
  const ctrl = workflow.createExecution(context)

  ctrl.on('step', async (step, event, cursor) => {
    const chunks: string[] = [pc.yellow(cursor.toString())]
    if (step.action) {
      const chunk = pc.blue(step.action.name) + pc.dim('@') + pc.green(step.action.attributes.as)
      chunks.push(chunk)
    }

    console.log(pc.dim('[['), chunks.join(' '), pc.dim(']]'))
    console.log()

    if (event.content) {
      console.log(pc.dim(event.content))
      console.log()
    }

    if (!step.action?.children.length) {
      let isStreaming = false

      event.action?.then((result) => {
        if (isStreaming) {
          process.stdout.write('\n')
        } else {
          console.log(result.result.value)
        }
        // either way, end the stream
        event.stream?.end()
        console.log()
      })

      if (event.stream) {
        for await (const chunk of event.stream) {
          isStreaming = true
          process.stdout.write(chunk)
        }
      }
    }
  })

  ctrl.on('error', (err) => {
    console.error(err)
  })

  ctrl.on('complete', (result) => {
    const usage = ctrl.state.actionLog.reduce((data, log) => {
      if (log.meta?.type === 'ai') {
        data.inputTokens += log.meta.data.usage.promptTokens
        data.outputTokens += log.meta.data.usage.completionTokens
      }
      return data
    }, { inputTokens: 0, outputTokens: 0 })

    displayTokenUsage(usage)
    mkdirSync(outputPath, { recursive: true })
    writeFileSync(
      join(outputPath, 'output.md'),
      appendFrontmatter(result, {
        title: workflow.title,
        created: now.toString(),
        usage,
      }),
      { encoding: 'utf8' }
    )
  })

  return ctrl.runAll()
}

function findPath(baseDir: string, name: string): string {
  const path = ['md', 'mdx']
    .map(ext => join(baseDir, `${name}.${ext}`))
    .find(existsSync)

  if (!path) {
    throw new Error(`Workflow file not found for: ${name}`);
  }

  return path
}

function displayTokenUsage(usage: { inputTokens: number, outputTokens: number }) {
  const maxWidth = Math.min(80, process.stdout.columns || 80)

  console.log(pc.dim('-'.repeat(maxWidth)))
  console.log()
  console.log(pc.dim(pc.italic(`Token usage. Refer to your AI provider for costs.`)))
  console.log()
  console.log(pc.dim('Input tokens'), '  ', usage.inputTokens, pc.dim('tks'))
  console.log(pc.dim('Output tokens'), ' ', usage.outputTokens, pc.dim('tks'))
  console.log()
}

function appendFrontmatter(body: string, data: any) {
  return dd`
  ---
  ${stringifyYaml(data).trim()}
  ---

  ${body}
  `
}

function buildOutputPath(workflowName: string, now: Date): string {
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '')
  const daySecs = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds()
  const dayStr = daySecs.toString().padStart(5, '0')
  return join('outputs', dateStr, `${dayStr}-${workflowName}`)
}

export default cmd
