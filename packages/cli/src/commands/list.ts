import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Command } from 'commander'
import { bold } from 'picocolors'
import { globSync } from 'fast-glob'
import { compileSync, Runtime } from '@ada/core'

import { resolveConfig } from '../config'

const cmd = new Command

cmd
  .name('list')
  .alias('ls')
  .description('list workflows in this project')
  .action(listWorkflows)

async function listWorkflows() {
  const cwd = process.cwd()
  const config = await resolveConfig(cwd)
  const runtime = new Runtime(config)
  const flowsPath = join(cwd, config.paths.flows, '*.{md,mdx}')

  // Collect workflows into rows
  const rows: {id: string, title: string}[] = []
  for (const path of globSync(flowsPath)) {
    try {
      const id = basename(path).replace(/\.mdx?$/, '')
      const data = readFileSync(path, { encoding: 'utf8' })
      const file = compileSync(data, { runtime })
      const workflow = file.result
      rows.push({ id, title: workflow.title })
    } catch(e) {
      console.error(`Invalid workflow: ${basename(path).replace(/\.mdx?$/, '')}`)
    }
  }

  // Get units for alignment
  const wMax = process.stdout.columns || 80
  const wId = Math.max(...rows.map(r => r.id.length))
  const wTitle = wMax - wId - 4

  // Print to console
  console.log('Workflows:')
  for (const row of rows) {
    const truncTitle = row.title.length > wTitle
      ? row.title.slice(0, wTitle - 1) + '…'
      : row.title
    console.log(`  ${bold(row.id).padEnd(wId)}  ${truncTitle}`)
  }
}

export default cmd
