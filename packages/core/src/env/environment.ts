import { experimental_createProviderRegistry as createProviderRegistry } from 'ai'
import { kebabCase } from 'change-case'
import { condAction, loopAction, genTextAction, genObjectAction } from '../actions'

import type { LanguageModel, Provider } from 'ai'
import type { VFile } from 'vfile'
import type { z } from 'zod'
import type { UserConfig } from './config'
import type { Action } from '../action'
import type { ContextValueMap } from '../context'
import type { Tool } from '../tool'
import type { Workflow, WorkflowValidator, InputResolver } from '../workflow'

// Default actions
const actions: Action[] = [
  condAction,
  loopAction,
  genTextAction,
  genObjectAction,
]

// Default tools
const tools: Tool<z.ZodType>[] = []

export class Environment {
  private actions: ActionRegistry = defaultRegistry(actions)
  private input?: InputResolver
  private tools: ToolRegistry = defaultRegistry(tools)
  private providers: Provider = createProviderRegistry({})
  private validations: WorkflowValidator[] = []

  constructor(config: UserConfig = {}) {
    // Register user actions
    config.actions?.forEach(action => {
      this.registerAction(kebabCase(action.name), action)
    })

    // Apply input Resolver
    this.input = config.input

    // Register user tools
    config.tools?.forEach(tool => {
      this.registerTool(tool.name, tool)
    })

    // Set default or user providers
    if (config.providers) {
      this.providers = createProviderRegistry(config.providers)
    }

    // Append user validators
    config.validators?.forEach(validator => {
      this.validations.push(validator)
    })

    // Apply plugins
    config.plugins?.forEach(plugin => {
      plugin(this)
    })
  }

  hasAction(name: string): boolean {
    return !!this.actions[name]
  }

  hasTool(name: string): boolean {
    return !!this.tools[name]
  }

  resolveInput(workflow: Workflow): ContextValueMap {
    return typeof this.input === 'function'
      ? this.input(workflow.meta)
      : {}
  }

  registerAction(action: Action): void
  registerAction(name: string, action: Action): void
  registerAction(nameOrAction: string | Action, maybeAction?: Action): void {
    const [name, action] = normalizeParams<Action>(nameOrAction, maybeAction)
    if (this.hasAction(name)) {
      throw new Error(`Action already registered: ${name}`)
    }

    this.actions[name] = action!
  }

  registerTool(tool: Tool<z.ZodType>): void
  registerTool(name: string, tool: Tool): void
  registerTool(nameOrTool: string | Tool, maybeTool?: Tool): void {
    const [name, tool] = normalizeParams<Tool>(nameOrTool, maybeTool)
    if (this.hasTool(name)) {
      throw new Error(`Tool already registered: ${name}`)
    }

    this.tools[name] = tool!
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

  validate(workflow: Workflow, file: VFile): void {
    for (const validator of this.validations) {
      validator(workflow, file)
    }
  }
}

function defaultRegistry<T extends { name: string }>(items: T[]): Record<string, T> {
  return items.reduce((map, item) => {
    return { ...map, [item.name]: item }
  }, {})
}

// Helpers

function normalizeParams<T extends { name: string }>(
  nameOrItem: string | T,
  item?: T,
): [name: string, item: T] {
  let name: string
  if (typeof nameOrItem === 'string') {
    name = nameOrItem
  } else {
    name = nameOrItem.name
    item = nameOrItem
  }

  if (!item) throw new Error(`Cannot register '${name}' without valid item`)
  return [name, item]
}

// Types

export type Plugin = (env: Environment) => void

type ActionRegistry = Record<string, Action>
type ToolRegistry = Record<string, Tool<z.ZodType>>
