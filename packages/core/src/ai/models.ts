export const models: Record<string, ModelSpec> = {
  // OpenAI
  'openai:gpt-4o': {
    inputCostPerToken: 0.0005,
    outputCostPerToken: 0.0015,
    supportsTools: true,
    supportsVision: true,
  },
  'openai:gpt-4o-2024-08-06': {
    inputCostPerToken: 0.00025,
    outputCostPerToken: 0.001,
    supportsTools: true,
    supportsVision: true,
  },
  'openai:gpt-4o-2024-05-13': {
    inputCostPerToken: 0.0005,
    outputCostPerToken: 0.0015,
    supportsTools: true,
    supportsVision: true,
  },
  'openai:gpt-4o-mini': {
    inputCostPerToken: 0.000015,
    outputCostPerToken: 0.000060,
    supportsTools: true,
    supportsVision: true,
  },
  'openai:gpt-4o-mini-2024-07-18': {
    inputCostPerToken: 0.000015,
    outputCostPerToken: 0.000060,
    supportsTools: true,
    supportsVision: true,
  },

  // Anthropic
  'anthropic:claude-3-5-sonnet-20240620': {
    inputCostPerToken: 0.0003,
    outputCostPerToken: 0.0015,
    supportsTools: true,
    supportsVision: true,
  },
  'anthropic:claude-3-haiku-20240307': {
    inputCostPerToken: 0.000025,
    outputCostPerToken: 0.000125,
    supportsTools: true,
    supportsVision: true,
  },
  'anthropic:claude-3-opus-20240307': {
    inputCostPerToken: 0.0015,
    outputCostPerToken: 0.0075,
    supportsTools: true,
    supportsVision: true,
  },
  'anthropic:claude-3-sonnet-20240307': {
    inputCostPerToken: 0.0003,
    outputCostPerToken: 0.0015,
    supportsTools: true,
    supportsVision: true,
  },

  // Google
  'google:gemini-1.5-flash': {
    inputCostPerToken: 0.0000075,
    outputCostPerToken: 0.00003,
    supportsTools: true,
    supportsVision: true,
  },
  'google:gemini-1.5-pro': {
    inputCostPerToken: 0.00035,
    outputCostPerToken: 0.00105,
    supportsTools: true,
    supportsVision: true,
  },
  'google:gemini-1.0-pro': {
    inputCostPerToken: 0.00005,
    outputCostPerToken: 0.00015,
    supportsTools: true,
    supportsVision: true,
  }
}

// Types

export type ModelSpec = {
  inputCostPerToken: number,    // penny per token
  outputCostPerToken: number,   // penny per token
  supportsTools?: boolean,
  supportsVision?: boolean,
}
