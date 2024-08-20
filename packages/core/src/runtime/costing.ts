import { type ModelReference, type ModelSpec } from '../models'

export class CostCalculator {
  readonly models: Record<ModelReference, ModelSpec> = {}

  constructor(models?: Record<ModelReference, ModelSpec>) {
    Object.assign(this.models, models)
  }

  updateModels(models: Record<ModelReference, ModelSpec>) {
    Object.assign(this.models, models)
  }

  
}