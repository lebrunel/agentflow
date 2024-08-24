import type { CompletionTokenUsage } from 'ai'
import {
  models as defaultModels,
  type ModelReference,
  type ModelSpec,
} from '../models'

export class CostCalculator {
  readonly models: Record<ModelReference, ModelSpec> = {}
  readonly uncosted: UncostedRecord[] = []
  #inputCost: number = 0
  #inputTokens: number = 0
  #outputCost: number = 0
  #outputTokens: number = 0

  constructor(models: Record<ModelReference, ModelSpec> = defaultModels) {
    Object.assign(this.models, models)
  }

  get inputCost(): number {
    return this.#inputCost
  }

  get inputTokens(): number {
    return this.#inputTokens
  }

  get outputCost(): number {
    return this.#outputCost
  }

  get outputTokens(): number {
    return this.#outputTokens
  }

  get totalCost(): number {
    return this.inputCost + this.outputCost
  }

  addUsage(model: ModelReference, usage: CompletionTokenUsage): void {
    this.#inputTokens += usage.promptTokens
    this.#outputTokens += usage.completionTokens

    const spec = this.models[model]
    if (typeof spec === 'undefined') {
      this.uncosted.push({ model, usage })
      return
    }
    this.#inputCost += spec.inputCostPerToken * usage.promptTokens
    this.#outputCost += spec.outputCostPerToken * usage.completionTokens
  }
}

export function formatMoney(amount: number, currencySymbol: string = '$') {
  const units = amount / 100
  return `${currencySymbol} ${units.toFixed(4)}`
}

interface UncostedRecord {
  model: ModelReference;
  usage: CompletionTokenUsage;
}
