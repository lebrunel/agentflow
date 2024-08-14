import { Command, Option } from 'commander'
import { resolveConfig } from '~/config'

const cmd = new Command('exec')

cmd
  .description('executes the given workflow')
  .argument('<workflow>', 'name of the workflow')
  .option('--foo', 'xxxx')
  .action(execWorkflow)

async function execWorkflow(workflowName: string) {
  const config = await resolveConfig(process.cwd())
  console.log('TODO', workflowName, { config })
}

export default cmd

