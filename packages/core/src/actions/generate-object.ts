import { z } from 'zod'
import { generateObject } from 'ai'
import { defineAction } from '../action'
import { aiGenerationOptions, toCoreMessage, SYSTEM_PROMPT } from'./support/ai'

import type { CoreMessage } from 'ai'
import type { ExecutionController } from '../runtime'

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
  execute: async function(this: ExecutionController, props, input) {
    const results = this.state.getPhaseResults(this.cursor)
    const messages: CoreMessage[] = []

    for (const res of results) {
      messages.push(toCoreMessage('user', res.input))
      messages.push(toCoreMessage('assistant', [res.output]))
    }
    messages.push(toCoreMessage('user', input))

    const opts = {
      model: this.runtime.useLanguageModel(props.model),
      system: SYSTEM_PROMPT,
      messages,
      schema: props.schema,
      schemaName: props.schemaName,
      schemaDeschemaDescription: props.schemaDescription,
      ...props.options
    }

    const { object, usage } = await generateObject(opts)

    return {
      result: { type: 'json', value: object },
      meta: { usage },
    }
  }
})
