import { Command } from 'commander'
import { createAgentflow } from 'create-agentflow'

const cmd = new Command

cmd
  .name('init')
  .alias('i')
  .description('create a new agentflow project')
  .argument('[path]', 'project path')
  .option('-t, --template <name>', 'project template', 'default')
  .action(initProject)

function initProject(path: string, opts: { template: string }) {
  return createAgentflow({
    cwd: process.cwd(),
    path,
    template: opts.template,
  })
}

export default cmd
