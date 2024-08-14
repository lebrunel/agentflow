import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Command } from 'commander'

import init from './commands/init'
import list from './commands/list'
import exec from './commands/exec'

const pkgPath = resolve(__dirname, '../package.json')

const pkg = JSON.parse(readFileSync(pkgPath, { encoding: 'utf8' }))
const cli = new Command()

cli
  .name('ada')
  .description('Project ADA prototype')
  .version(pkg.version)
  .addCommand(init)
  .addCommand(list)
  .addCommand(exec)

await cli.parseAsync()
