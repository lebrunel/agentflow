import { experimental_createProviderRegistry as createProviderRegistry } from 'ai'
import { kebabCase } from 'change-case'
import nPath from 'path-browserify'
import { condAction, loopAction, genTextAction, genObjectAction } from '../actions'
import { Prompt } from '../prompt'

import type { LanguageModel, Provider } from 'ai'
import type { VFile } from 'vfile'
import type { z } from 'zod'
import type { UserConfig } from './config'
import type { Action } from '../action'
import { createPromptProcessor, type WorkflowValidator } from '../ast'
import type { Tool } from '../tool'
import type { Workflow } from '../workflow'

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
  private prompts: PromptRegistry
  private providers: Provider
  private tools: ToolRegistry
  private validators: WorkflowValidator[]

  constructor(config: UserConfig = {}) {
    const builder = new EnvironmentBuilder(config)
    this.actions = builder.actions
    this.tools = builder.tools
    this.prompts = createPromptRegistry(builder.prompts, this)
    this.providers = builder.providers
    this.validators = builder.validators
  }

  useAction(name: string): Action {
    if (!this.actions[name]) {
      throw new Error(`Action not found: ${name}`)
    }
    return this.actions[name]
  }

  usePrompt(path: string): Prompt {
    path = nPath.normalize(path)
    if (nPath.extname(path) !== '.mdx') path += '.mdx'
    if (!this.prompts[path]) {
      throw new Error(`Prompt not found: ${path}`)
    }
    return this.prompts[path]
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
    for (const validator of this.validators) {
      validator(workflow, file)
    }
  }
}

export class EnvironmentBuilder {
  actions: ActionRegistry = defaultRegistry(actions)
  tools: ToolRegistry = defaultRegistry(tools)
  prompts: Record<string, string>
  providers: Provider = createProviderRegistry({})
  validators: WorkflowValidator[] = []

  constructor(config: UserConfig = {}) {
    config.actions?.forEach(action => {
      this.registerAction(action.name, action)
    })

    // Register user tools
    config.tools?.forEach(tool => {
      this.registerTool(tool.name, tool)
    })

    // Set prompts as object
    this.prompts = typeof config.prompts === 'function'
      ? config.prompts()
      : (config.prompts || {})

    // Set default or user providers
    if (config.providers) {
      this.providers = createProviderRegistry(config.providers)
    }

    // Append user validators
    config.validators?.forEach(validator => {
      this.validators.push(validator)
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

function createPromptRegistry(
  prompts: Record<string, string>,
  env: Environment,
): PromptRegistry {
  const proc = createPromptProcessor(env)
  return Object.entries(prompts).reduce((obj, [path, value]) => {
    const key = nPath.normalize(path)
    obj[key] = new Prompt(key, value, proc)
    return obj
  }, {} as PromptRegistry)
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
type PromptRegistry = Record<string, Prompt>
type ToolRegistry = Record<string, Tool>
