import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { Command } from 'commander'
import { blue, bold, dim, italic } from 'picocolors'
import { compileSync, executeWorkflow, util, Runtime } from '@ada/core2'
import type { UserConfig } from '@ada/core2'

import { resolveConfig } from '../config'
import { promptInputs } from '../prompts'
import type { CostCalculator } from '@ada/core2'

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
  const flowName = basename(name, extname(name))

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

  ctrl.on('action', async ({ action, stream, input, result }) => {
    console.log(dim('[['), `${blue(action.name)}@${blue(action.props.name)}`, dim(']]'))
    console.log()
    console.log(dim(input))
    console.log()

    let isStreaming = false

    result.then((result) => {
      if (isStreaming) {
        process.stdout.write('\n')
      } else {
        console.log(result.output.value)
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
