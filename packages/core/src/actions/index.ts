import { GenerateAction } from './generate'

const actions = {
  generate: GenerateAction
}

export function useAction(name: string) {
  const Action = actions[name as keyof typeof actions]
  if (!Action) throw new Error(`Action node found: ${name}`)
  return Action
}