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
  private actions: ActionRegistry
  private inputResolver?: InputResolver
  private tools: ToolRegistry
  private providers: Provider
  private validations: WorkflowValidator[]

  constructor(config: UserConfig = {}) {
    const builder = new EnvironmentBuilder(config)
    this.actions = builder.actions
    this.inputResolver = builder.inputResolver
    this.tools = builder.tools
    this.providers = builder.providers
    this.validations = builder.validations
  }

  resolveInput(workflow: Workflow): ContextValueMap {
    return typeof this.inputResolver === 'function'
      ? this.inputResolver(workflow.meta)
      : {}
  }

  useAction(name: string): Action {
    if (!this.actions[name]) {
      throw new Error(`Action not found: ${name}`)
    }
    return this.actions[name]
  }

  useTool(name: string): Tool<z.ZodType> {
    if (!this.tools[name]) {
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

export class EnvironmentBuilder {
  actions: ActionRegistry = defaultRegistry(actions)
  inputResolver?: InputResolver
  tools: ToolRegistry = defaultRegistry(tools)
  providers: Provider = createProviderRegistry({})
  validations: WorkflowValidator[] = []

  constructor(config: UserConfig = {}) {
    config.actions?.forEach(action => {
      this.registerAction(action.name, action)
    })

    // Apply input Resolver
    this.inputResolver = config.input

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

  registerAction(action: Action): void
  registerAction(name: string, action: Action): void
  registerAction(nameOrAction: string | Action, maybeAction?: Action): void {
    const [name, action] = normalizeParams<Action>(nameOrAction, maybeAction, kebabCase)
    if (!!this.actions[name]) {
      throw new Error(`Action already registered: ${name}`)
    }

    this.actions[name] = action!
  }

  registerTool(tool: Tool<z.ZodType>): void
  registerTool(name: string, tool: Tool): void
  registerTool(nameOrTool: string | Tool, maybeTool?: Tool): void {
    const [name, tool] = normalizeParams<Tool>(nameOrTool, maybeTool)
    if (!!this.tools[name]) {
      throw new Error(`Tool already registered: ${name}`)
    }

    this.tools[name] = tool!
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
  format: (key: string) => string = (key) => key
): [name: string, item: T] {
  let name: string
  if (typeof nameOrItem === 'string') {
    name = format(nameOrItem)
  } else {
    name = format(nameOrItem.name)
    item = nameOrItem
  }

  if (!item) throw new Error(`Cannot register '${name}' without valid item`)
  return [name, item]
}

// Types

export type Plugin = (env: EnvironmentBuilder) => void

type ActionRegistry = Record<string, Action>
type ToolRegistry = Record<string, Tool<z.ZodType>>
