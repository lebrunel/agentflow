import { Command } from 'commander'
import { Workflow } from '@ada/core2'

const cmd = new Command

cmd
  .name('init')
  .description('create a new workflow project folder')
  .action(initProject)

function initProject() {
  console.log('TODO', Workflow)
}

export default cmd
