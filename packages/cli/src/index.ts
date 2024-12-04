import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Command } from 'commander'
import pc from 'picocolors'
import dotenv from 'dotenv'

import init from './commands/init'
import list from './commands/list'
import exec from './commands/exec'

const cwd = process.cwd()
dotenv.config({ path: resolve(cwd, '.env') })

const pkgPath = resolve(__dirname, '../package.json')

const pkg = JSON.parse(readFileSync(pkgPath, { encoding: 'utf8' }))
const cli = new Command('ada')

const bannerText = `${pc.bold('AgentFlow')}
  ${pc.dim('version:')} ${pc.green(pkg.version)}\n`

cli
  .name('aflow')
  .description('AgentFlow')
  .version(pkg.version)
  .addHelpText('before', bannerText)
  .hook('preAction', () => console.log(bannerText))
  .addCommand(init)
  .addCommand(list)
  .addCommand(exec)

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Exiting gracefully...')
  process.exit(0)
})

try {
  await cli.parseAsync()
} catch(e: any) {
  console.log(pc.bgRed('Error'), e.message)
  console.log(e)
  process.exit(1)
}
