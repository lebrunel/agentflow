import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { dedent as dd } from 'ts-dedent'
import pc from 'picocolors'
import dotenv from 'dotenv'

import init from './commands/init'
import list from './commands/list'
import exec from './commands/exec'

const cwd = process.cwd()
dotenv.config({ path: resolve(cwd, '.env') })

const pkgPath = resolve(__dirname, '../package.json')

const pkg = JSON.parse(readFileSync(pkgPath, { encoding: 'utf8' }))
const cli = new Command()

function banner() {
  console.log(dd`
  ${pc.bold('Agentflow')}
    ${pc.dim('version:')} ${pc.green(pkg.version)}
  `)
  console.log()
}

cli
  .name('agentflow')
  .alias('aflow')
  .version(pkg.version)
  .hook('preAction', banner)
  .addCommand(init)
  .addCommand(list)
  .addCommand(exec)
  .showHelpAfterError()
  .action(() => cli.help()) // default command

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Exiting gracefully...')
  process.exit(0)
})

try {
  await cli.parseAsync()
  process.exit(0)
} catch(e: any) {
  console.log(pc.bgRed('Error'), e.message)
  console.log(e)
  process.exit(1)
}
