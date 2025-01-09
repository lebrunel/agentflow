import type { Provider } from 'ai'
import type { z } from 'zod'

import type { Plugin } from './environment'
import type { Action } from '../action'
import type { WorkflowValidator } from '../ast'
import type { Tool } from '../tool'

/**
 * TODO
 */
export function defineConfig(config: UserConfig | (() => UserConfig)): UserConfig {
  return typeof config === 'function' ? config() : config
}

// Types

export interface UserConfig {
  actions?: Action[];
  tools?: Tool<z.ZodType>[];
  prompts?: Record<string, string> | (() => Record<string, string>);
  providers?: Record<string, Provider>;
  plugins?: Plugin[];
  validators?: WorkflowValidator[];
}
