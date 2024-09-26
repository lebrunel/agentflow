import type { LanguageModelUsage } from 'ai'

import { models as defaultModels, type ModelSpec } from './models'

export class CostCalculator {
  readonly models: Record<string, ModelSpec> = {}
  readonly uncosted: UncostedRecord[] = []
  #inputCost: number = 0
  #inputTokens: number = 0
  #outputCost: number = 0
  #outputTokens: number = 0

  constructor(models: Record<string, ModelSpec> = defaultModels) {
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

  get data() {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      inputCost: formatMoney(this.inputCost),
      outputCost: formatMoney(this.outputCost),
      totalCost: formatMoney(this.totalCost),
    }
  }

  addUsage(model: string, usage: LanguageModelUsage): void {
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
  model: string;
  usage: LanguageModelUsage;
}
