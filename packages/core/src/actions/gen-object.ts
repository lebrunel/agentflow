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
  name: 'gen-object',
  schema,
  helpers: { z },
  execute: async function(props, { input, results, meta, runtime }) {
    const messages: CoreMessage[] = []

    for (const res of results) {
      messages.push(await toCoreMessage('user', res.input))
      messages.push(await toCoreMessage('assistant', [res.output]))
    }
    messages.push(await toCoreMessage('user', input))

    const opts = {
      model: runtime.useLanguageModel(props.model),
      system: SYSTEM_PROMPT,
      messages,
      schema: props.schema,
      schemaName: props.schemaName,
      schemaDeschemaDescription: props.schemaDescription,
      ...props.options
    }

    const { object, usage } = await generateObject(opts)

    meta.usage = usage

    return { type: 'json', value: object as any }
  }
})
