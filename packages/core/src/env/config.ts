import type { Provider } from 'ai'
import type { z } from 'zod'

import type { Plugin } from './environment'
import type { Action } from '../action'
import type { Tool } from '../tool'
import type { InputResolver, WorkflowValidator } from '../workflow'

/**
 * TODO
 */
export function defineConfig(config: UserConfig | (() => UserConfig)): UserConfig {
  return typeof config === 'function' ? config() : config
}

// Types

export interface UserConfig {
  actions?: Action[];
  input?: InputResolver;
  tools?: Tool<z.ZodType>[];
  providers?: Record<string, Provider>;
  plugins?: Plugin[];
  validators?: WorkflowValidator[];
}
