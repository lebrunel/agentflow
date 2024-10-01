import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { UserConfig } from '@agentflow/core'

const CONFIG_FILE_NAME = 'agentflow.config.js'

export async function resolveConfig(baseDir: string): Promise<ResolvedConfig> {
  const configPath = resolve(baseDir, CONFIG_FILE_NAME)

  let userConfig: UserConfig = {}
  if (existsSync(configPath)) {
    const { default: config } = await import(configPath)
    userConfig = config
  }

  return {
    ...userConfig,
    paths: { flows: 'flows', outputs: 'outputs' }
  }
}


export interface ResolvedConfig extends UserConfig {
  paths: {
    flows: string,
    outputs: string,
  }
}
