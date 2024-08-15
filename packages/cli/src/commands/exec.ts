import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Command } from 'commander'
import { compileWorkflow, executeWorkflow, ExecutionController, Runtime } from '../../../core/src/index.ts'

import { resolveConfig } from '~/config'

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
  const runtime = new Runtime(config)
  const flowName = name.trim().replace(/(.md)?$/, '.md')
  const flowPath = join(cwd, config.paths.flows, flowName)
  const flowStr = readFileSync(flowPath, { encoding: 'utf8' })

  const workflow = compileWorkflow(flowStr, runtime)
  const ctrl = executeWorkflow(workflow, {
    name: { type: 'text', text: 'Bob' },
    style: { type: 'text', text: 'Raggae' }
  }, runtime)

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
      console.log(result)
      resolve()
    })
  })
}

export default cmd

