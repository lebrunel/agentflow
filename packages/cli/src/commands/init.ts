import { Command, Option } from 'commander'

const cmd = new Command

cmd
  .name('init')
  .description('create a new workflow project folder')
  .action(initProject)

function initProject() {
  console.log('TODO')
}

export default cmd

