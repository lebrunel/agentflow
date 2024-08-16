import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { bold, dim, green } from 'picocolors'

import init from './commands/init'
import list from './commands/list'
import exec from './commands/exec'

const pkgPath = resolve(__dirname, '../package.json')

const pkg = JSON.parse(readFileSync(pkgPath, { encoding: 'utf8' }))
const cli = new Command('ada')

const bannerText = `${bold('ADA')}
  ${dim('version:')} ${green(pkg.version)}\n`

cli
  .name('ada')
  .description('Project ADA prototype')
  .version(pkg.version)
  .addHelpText('before', bannerText)
  .hook('preAction', () => console.log(bannerText))
  .addCommand(init)
  .addCommand(list)
  .addCommand(exec)

await cli.parseAsync()
