import { Command, Option } from 'commander'

const cmd = new Command

cmd
  .name('exec')
  .description('executes the given workflow')
  .argument('<workflow>', 'name of the workflow')
  .option('--foo', 'xxxx')
  .action(execWorkflow)

function execWorkflow(workflowName: string) {
  console.log('TODO', workflowName)
}

export default cmd

