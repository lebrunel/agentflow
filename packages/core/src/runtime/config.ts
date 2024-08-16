import type { experimental_Provider as Provider } from 'ai'
import type { ActionHandler } from './action'
import type { Plugin, __Tool } from './runtime'

export function defineConfig(config: UserConfig): UserConfig
export function defineConfig(config: UserConfigFn): UserConfigFn
export function defineConfig(config: ConfigExport): ConfigExport {
  return config
}

// Types

export interface UserConfig {
  actions?: ActionHandler[];
  tools?: __Tool[];
  providers?: Record<string, Provider>;
  plugins?: Plugin[];
}

export type UserConfigFn = () => UserConfig

export type ConfigExport = UserConfig | UserConfigFn