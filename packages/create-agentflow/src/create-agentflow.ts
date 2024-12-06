import minimist from 'minimist'
import { createAgentflow } from './index'

const argv = minimist(process.argv.slice(2), {
  string: ['_'],
  alias:    { template: 't' },
  default:  { template: 'default' },
})

createAgentflow({
  cwd: process.cwd(),
  path: argv._[0]?.trim(),
  template: argv.template,
}).catch(e => {
  console.error(e)
})
