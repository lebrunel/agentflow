import { experimental_createProviderRegistry as createProviderRegistry } from 'ai'
import type { experimental_ProviderRegistry as ProviderRegistry, LanguageModel } from 'ai'
import type { z } from 'zod'
import { ifAction, loopAction, genTextAction, genObjectAction } from '../actions'
import type { UserConfig } from './config'
import type { Action } from '../action'
import type { Tool } from '../tool'
import { kebabCase } from 'change-case'

const builtInActions: Action[] = [
  ifAction,
  loopAction,
]

const actions: Action[] = [
  genTextAction,
  genObjectAction,
]

// Default tools
const tools: Tool<z.ZodType>[] = []

export class Runtime {
  private actions: ActionRegistry = defaultRegistry(actions)
  private tools: ToolRegistry = defaultRegistry(tools)
  private providers: ProviderRegistry = createProviderRegistry({})

  constructor(config: UserConfig = {}) {
    for (const action of builtInActions) {
      this.registerAction(kebabCase(action.name), action)
    }

    // Register user actions
    if (config.actions?.length) {
      for (const action of config.actions) {
        this.registerAction(kebabCase(action.name), action)
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

  registerAction(name: string, action: Action): void {
    if (this.hasAction(name)) {
      throw new Error(`Action already registered: ${name}`)
    }
    this.actions[name] = action
  }

  registerTool(name: string, tool: Tool<z.ZodType>): void {
    if (this.hasTool(name)) {
      throw new Error(`Tool already registered: ${name}`)
    }
    this.tools[name] = tool
  }

  useAction(name: string): Action {
    if (!this.hasAction(name)) {
      throw new Error(`Action not found: ${name}`)
    }
    return this.actions[name]
  }

  useTool(name: string): Tool<z.ZodType> {
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

type ActionRegistry = Record<string, Action>
type ToolRegistry = Record<string, Tool<z.ZodType>>
