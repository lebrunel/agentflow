import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { RuntimeConfig } from '@ada/core'

export function defineConfig(config: UserConfig): UserConfig
export function defineConfig(config: UserConfigFn): UserConfigFn
export function defineConfig(config: ConfigExport): ConfigExport {
  return config
}

export async function resolveConfig(baseDir: string): Promise<ResolvedConfig> {
  const configPath = resolve(baseDir, 'ada.config.ts')

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

// Types

export interface ResolvedConfig extends RuntimeConfig {
  paths: {
    flows: string,
    outputs: string,
  }
}

export type UserConfig = RuntimeConfig

export type UserConfigFn = () => UserConfig

export type ConfigExport = UserConfig | UserConfigFn