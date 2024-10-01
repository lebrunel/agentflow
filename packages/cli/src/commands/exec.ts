import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { Command } from 'commander'
import pc from 'picocolors'
import { dedent as dd } from 'ts-dedent'
import { stringify as stringifyYaml } from 'yaml'
import { compileSync, executeWorkflow, Runtime } from '@agentflow/core'
import { createFileSystemTools } from '@agentflow/tools'
import type { UserConfig } from '@agentflow/core'

import { resolveConfig } from '../config'
import { promptInputs } from '../prompts'
import type { CostCalculator } from '@agentflow/core'

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
  const runtime = new Runtime(config as UserConfig)
  const flowName = basename(name, extname(name))
  const outputPath = buildOutputPath(config.paths.outputs, flowName, now)

  const fileSystem = createFileSystemTools(join(outputPath, 'files'))
  runtime.registerTool(fileSystem.write_files)

  let flowPath: string | undefined
  for (const ext of ['md', 'mdx']) {
    const possiblePath = join(cwd, config.paths.flows, `${flowName}.${ext}`)
    if (existsSync(possiblePath)) {
      flowPath = possiblePath
      break
    }
  }

  if (!flowPath) {
    throw new Error(`Workflow file not found for: ${name}`);
  }

  const flowStr = readFileSync(flowPath, { encoding: 'utf8' })

  const file = compileSync(flowStr, { runtime })
  // todo - check for error messages on file
  const workflow = file.result

  console.log(`🚀 ${pc.bold(workflow.title)}`)
  console.log()
  //console.log(workflow.description)
  //console.log()

  const context = await promptInputs(workflow.inputSchema)
  console.log()
  const ctrl = executeWorkflow(workflow, context, runtime)

  ctrl.on('action', async ({ action, stream, input, output }, cursor) => {
    console.log(pc.dim('[['), pc.yellow(cursor.toString()), pc.blue(action.name), pc.green(action.contextKey), pc.dim(']]'))
    console.log()
    console.log(pc.dim(input))
    console.log()

    let isStreaming = false

    output.then((result) => {
      if (isStreaming) {
        process.stdout.write('\n')
      } else {
        console.log(result)
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

  ctrl.on('error', (err) => {
    console.error(err)
  })

  return new Promise<void>(resolve => {
    ctrl.on('complete', (result) => {
      const calculator = ctrl.getCostEstimate()
      displayUsageCost(calculator)
      mkdirSync(outputPath, { recursive: true })
      writeFileSync(
        join(outputPath, 'output.md'),
        appendFrontmatter(result, {
          title: workflow.title,
          created: now.toString(),
          usage: calculator.data
        }),
        { encoding: 'utf8' }
      )
      resolve()
    })
  })
}

function displayUsageCost(calculator: CostCalculator) {
  const maxWidth = Math.min(80, process.stdout.columns || 80)
  const formatCost = (cost: number) => (cost/100).toFixed(4)

  console.log(pc.dim('-'.repeat(maxWidth)))
  console.log()
  console.log(pc.dim(pc.italic(`Costs are estimated and will not be 100% accurate.`)))
  console.log(pc.dim(pc.italic(`Refer to your AI provider for actual costs.`)))
  console.log()
  console.log(pc.dim('Input cost'), '  ', pc.dim('$'), formatCost(calculator.inputCost), ' ', pc.dim(`${calculator.inputTokens} tks`))
  console.log(pc.dim('Output cost'), ' ', pc.dim('$'), formatCost(calculator.outputCost), ' ', pc.dim(`${calculator.outputTokens} tks`))
  console.log(pc.dim('-'.repeat(22)))
  console.log(pc.dim(pc.bold('Total')), '       ', pc.dim(pc.bold('$')), pc.bold(formatCost(calculator.totalCost)))
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

function buildOutputPath(baseDir: string, workflowName: string, now: Date): string {
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '')
  const daySecs = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds()
  const dayStr = daySecs.toString().padStart(5, '0')
  return join(baseDir, dateStr, `${dayStr}-${workflowName}`)
}

export default cmd
