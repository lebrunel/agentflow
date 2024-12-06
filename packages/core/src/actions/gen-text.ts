import { z } from 'zod'
import { generateText, streamText } from 'ai'
import { aiGenerationOptions, toCoreMessage, toCoreTool, SYSTEM_PROMPT } from'./support/ai'
import { defineAction } from '../action'

import type { CoreMessage, CoreTool, GenerateTextResult } from 'ai'

const schema = z.object({
  model: z.string(),
  stream: z.boolean().optional(),
  tools: z.array(z.string()).optional(),
  options: aiGenerationOptions.default({})
})

export default defineAction({
  name: 'gen-text',
  schema,
  execute: async function(ctx, props) {
    const env = ctx.useEnv()
    const stream = ctx.useStream()
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
      system: SYSTEM_PROMPT,
      messages,
      tools,
      ...props.options
    }

    async function streamPromise(): Promise<GenerateTextResult<typeof tools, unknown>> {
      return new Promise(async (resolve) => {
        const { textStream } = streamText({
          ...opts,
          onFinish: (res) => resolve(res as GenerateTextResult<typeof tools, unknown>)
        })

        for await (const chunk of textStream) {
          stream.push(chunk)
        }
      })
    }

    const response = await (props.stream === false
      ? generateText(opts)
      : streamPromise()
    )

    ctx.pushResponseMeta('ai', response)
    return { type: 'primitive', value: response.text }
  }
})
