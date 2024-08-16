import {
  experimental_createProviderRegistry as createProviderRegistry,
  type experimental_ProviderRegistry as ProviderRegistry,
  type LanguageModel
} from 'ai'

import { generateTextAction } from '../actions/generate'
import type { ActionHandler } from './action'
import type { UserConfig } from './config'

// Default actions
const actions: ActionHandler[] = [
  generateTextAction
]

// Default tools
const tools: __Tool[] = []

export class Runtime {
  private actions: ActionRegistry = defaultRegistry(actions)
  private tools: ToolRegistry = defaultRegistry(tools)
  private providers: ProviderRegistry = createProviderRegistry({})

  constructor(config: UserConfig) {
    // Register user actions
    if (config.actions?.length) {
      for (const action of config.actions) {
        this.registerAction(action.name, action)
      }
    }

    // Register user tools
    if (config.tools?.length) {
      for (const tool of config.tools) {
        this.registerTool(tool.name, tool)
      }
    }

    // Set default or user providers
    if (config.providers) {
      this.providers = createProviderRegistry(config.providers)
    }

    if (config.plugins?.length) {
      for (const plugin of config.plugins) {
        plugin(this)
      }
    }
  }

  hasAction(name: string): boolean {
    return !!this.actions[name]
  }

  hasTool(name: string): boolean {
    return !!this.tools[name]
  }

  registerAction(name: string, action: ActionHandler): void {
    if (this.hasAction(name)) {
      throw new Error(`Action already registered: ${name}`)
    }
    this.actions[name] = action
  }

  registerTool(name: string, tool: __Tool): void {
    if (this.hasTool(name)) {
      throw new Error(`Tool already registered: ${name}`)
    }
    this.tools[name] = tool
  }

  useAction(name: string): ActionHandler {
    if (!this.hasAction(name)) {
      throw new Error(`Action not found: ${name}`)
    }
    return this.actions[name]
  }

  useTool(name: string): __Tool {
    if (!this.hasTool(name)) {
      throw new Error(`Tool not found: ${name}`)
    }
    return this.tools[name]
  }

  useLanguageModel(id: string): LanguageModel {
    return this.providers.languageModel(id)
  }
}

function defaultRegistry<T extends { name: string }>(items: T[]): Record<string, T> {
  return items.reduce((map, item) => {
    return { ...map, [item.name]: item }
  }, {})
}

// Types

export type Plugin = (runtime: Runtime) => void

type ActionRegistry = Record<string, ActionHandler>
type ToolRegistry = Record<string, __Tool>
export type __Tool = { name: string }
