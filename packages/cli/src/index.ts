import { readFileSync } from 'node:fs'
import { Command } from 'commander'

import init from './commands/init'
import exec from './commands/exec'

const pkg = JSON.parse(readFileSync('./package.json', { encoding: 'utf8' }))
const cli = new Command()

cli
  .name('ada')
  .description('Project ADA prototype')
  .version(pkg.version)
  .addCommand(init)
  .addCommand(exec)

cli.parse()
