import { z } from 'zod'
import { generateObject } from 'ai'
import { aiGenerationOptions, createSystemPrompt, toCoreMessage, toCoreTool } from'./support/ai'
import { defineAction } from '../action'

import type { CoreMessage, CoreTool } from 'ai'

const schema = z.object({
  model: z.string(),
  role: z.string().optional(),
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
      messages.push(await toCoreMessage('user', content))
      messages.push(await toCoreMessage('assistant', action!.result))
    }

    messages.push(await toCoreMessage('user', ctx.content))

    const tools: Record<string, CoreTool> = props.tools?.reduce((obj, name) => {
      const tool = env.useTool(name)
      obj[tool.name] = toCoreTool(tool)
      return obj
    }, {} as Record<string, CoreTool>) || {}

    const opts = {
      model: env.useLanguageModel(props.model),
      system: createSystemPrompt(props.role),
      messages,
      schema: props.schema,
      schemaName: props.schemaName,
      schemaDeschemaDescription: props.schemaDescription,
      tools,
      ...props.options
    }

    const response = await generateObject(opts)

    ctx.pushResponseMeta('ai', response)
    return { type: 'json', value: response.object as any }
  }
})
