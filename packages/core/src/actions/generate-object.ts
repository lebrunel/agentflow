import { z } from 'zod'
import { generateObject } from 'ai'
import { defineAction } from '../action'
import { aiGenerationOptions, toCoreMessage, SYSTEM_PROMPT } from'./support/ai'

import type { CoreMessage } from 'ai'

const schema = z.object({
  model: z.string(),
  schema: z.instanceof(z.ZodType),
  schemaName: z.string().optional(),
  schemaDescription: z.string().optional(),
  tools: z.array(z.string()).optional(),
  options: aiGenerationOptions.default({})
})

export default defineAction({
  name: 'generate-object',
  schema,
  execute: async ({ action, input, results, stream }, runtime) => {
    const messages: CoreMessage[] = []

    for (const res of results) {
      messages.push(toCoreMessage('user', res.input))
      messages.push(toCoreMessage('assistant', [res.output]))
    }
    messages.push(toCoreMessage('user', input))

    const opts = {
      model: runtime.useLanguageModel(action.props.model),
      system: SYSTEM_PROMPT,
      messages,
      schema: action.props.schema,
      schemaName: action.props.schemaName,
      schemaDeschemaDescription: action.props.schemaDescription,
      ...action.props.options
    }

    const { object, usage } = await generateObject(opts)

    return {
      output: { type: 'json', value: object },
      usage,
    }
  }
})
