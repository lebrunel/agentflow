import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { Command } from 'commander'
import { blue, bold, dim, green, italic, yellow } from 'picocolors'
import { default as dd } from 'ts-dedent'
import { stringify as stringifyYaml } from 'yaml'
import { compileSync, executeWorkflow, tools, Runtime } from '@ada/core'
import type { UserConfig } from '@ada/core'

import { resolveConfig } from '../config'
import { promptInputs } from '../prompts'
import type { CostCalculator } from '@ada/core'

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

  const fileSystem = tools.createFileSystemTools(join(outputPath, 'files'))
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

  console.log(`🚀 ${bold(workflow.title)}`)
  console.log()
  //console.log(workflow.description)
  //console.log()

  const context = await promptInputs(workflow.inputSchema)
  console.log()
  const ctrl = executeWorkflow(workflow, context, runtime)

  ctrl.on('action', async ({ action, stream, input, output }, cursor) => {
    console.log(dim('[['), yellow(cursor.toString()), blue(action.name), green(action.contextKey), dim(']]'))
    console.log()
    console.log(dim(input))
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

  console.log(dim('-'.repeat(maxWidth)))
  console.log()
  console.log(dim(italic(`Costs are estimated and will not be 100% accurate.`)))
  console.log(dim(italic(`Refer to your AI provider for actual costs.`)))
  console.log()
  console.log(dim('Input cost'), '  ', dim('$'), formatCost(calculator.inputCost), ' ', dim(`${calculator.inputTokens} tks`))
  console.log(dim('Output cost'), ' ', dim('$'), formatCost(calculator.outputCost), ' ', dim(`${calculator.outputTokens} tks`))
  console.log(dim('-'.repeat(22)))
  console.log(dim(bold('Total')), '       ', dim(bold('$')), bold(formatCost(calculator.totalCost)))
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
