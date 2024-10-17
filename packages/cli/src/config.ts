import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { UserConfig } from '@agentflow/core'

const CONFIG_FILE_BASE_NAME = 'agentflow.config'
const CONFIG_FILE_EXTS = ['js', 'mjs', 'ts']

export async function resolveConfig(baseDir: string): Promise<ResolvedConfig> {
  let userConfig: UserConfig = {}
  let configPath: string | undefined

  for (const ext of CONFIG_FILE_EXTS) {
    configPath = resolve(baseDir, `${CONFIG_FILE_BASE_NAME}.${ext}`)

    if (existsSync(configPath)) {
      const config = await import(configPath)
      userConfig = config.default || config
      break
    }
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
