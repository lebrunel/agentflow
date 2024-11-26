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
  execute: async function(ctx, props) {
    const env = ctx.useEnv()
    const results = ctx.getPhaseResults()

    const messages: CoreMessage[] = []

    for (const { action, content } of results) {
      messages.push({ role: 'user', content: content })
      messages.push(await toCoreMessage('assistant', action!.result))
    }

    messages.push({ role: 'user', content: ctx.content })

    const opts = {
      model: env.useLanguageModel(props.model),
      system: SYSTEM_PROMPT,
      messages,
      schema: props.schema,
      schemaName: props.schemaName,
      schemaDeschemaDescription: props.schemaDescription,
      ...props.options
    }

    const response = await generateObject(opts)

    ctx.pushResponseMeta('ai', response)
    return { type: 'json', value: response.object as any }
  }
})
