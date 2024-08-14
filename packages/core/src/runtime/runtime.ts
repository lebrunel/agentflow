import {
  experimental_createProviderRegistry as createProviderRegistry,
  type experimental_ProviderRegistry as ProviderRegistry,
  type LanguageModel
} from 'ai'

import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import { ollama } from 'ollama-ai-provider'

import { generateTextAction } from '~/actions/generate'

import type { ActionHandler } from '~/runtime/action'

// Default actions
const actions: ActionHandler[] = [
  generateTextAction
]

// Default tools
const tools: __Tool[] = []

export class Runtime {
  private actions: ActionRegistry = defaultRegistry(actions)
  private tools: ToolRegistry = defaultRegistry(tools)
  private providers: ProviderRegistry = defaultProviders()

  constructor(config: RuntimeConfig) {
    // Register user actions
    for (const name in config.actions) {
      this.registerAction(name, config.actions[name])
    }

    // Register user tools
    for (const name in config.tools) {
      this.registerTool(name, config.tools[name])
    }

    // Set default or user providers
    if (config.providers) {
      this.providers = config.providers
    } else {
      this.providers = defaultProviders()
    }

    if (config.plugins) {
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

function defaultProviders(): ProviderRegistry {
  return createProviderRegistry({
    anthropic,
    openai,
    google,
    ollama,
  })
}

// Types

export type Plugin = (runtime: Runtime) => void

export interface RuntimeConfig {
  actions?: ActionRegistry;
  tools?: ToolRegistry;
  providers?: ProviderRegistry;
  plugins?: Plugin[];
}

type ActionRegistry = Record<string, ActionHandler>
type ToolRegistry = Record<string, __Tool>
type __Tool = { name: string }