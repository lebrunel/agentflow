import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Command } from 'commander'
import pc from 'picocolors'
import fg from 'fast-glob'
import { Workflow, Environment } from '@agentflow/core'

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
  const env = new Environment(config)
  const flowsPath = join(cwd, 'flows', '*.{md,mdx}')

  // Collect workflows into rows
  const rows: {id: string, title: string}[] = []
  for (const path of fg.globSync(flowsPath)) {
    try {
      const id = basename(path).replace(/\.mdx?$/, '')
      const src = readFileSync(path, { encoding: 'utf8' })
      const workflow = Workflow.compileSync(src, env)
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
    console.log(`  ${pc.bold(row.id).padEnd(wId)}  ${truncTitle}`)
  }
}

export default cmd
