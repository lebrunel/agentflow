import { GenerateAction } from '~/actions/generate'
import { MockAction } from '~/actions/mock'

// Todo - create a registry so actions can dynamically be added

export const actions = {
  generate: GenerateAction,
  mock: MockAction,
}

export function useAction(name: string) {
  const Action = actions[name as keyof typeof actions]
  if (!Action) throw new Error(`Action node found: ${name}`)
  return Action
}