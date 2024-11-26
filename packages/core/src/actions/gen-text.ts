import { z } from 'zod'
import { generateText, streamText } from 'ai'
import { defineAction } from '../action'
import { aiGenerationOptions, toCoreMessage, SYSTEM_PROMPT } from'./support/ai'

import type { CoreMessage, CoreTool, GenerateTextResult, LanguageModelUsage, StreamTextResult } from 'ai'

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
    const results = ctx.getPrevStepResults()

    const messages: CoreMessage[] = []

    for (const { action, content } of results) {
      messages.push({ role: 'user', content: content })
      messages.push(await toCoreMessage('assistant', action!.result))
    }

    messages.push({ role: 'user', content: ctx.content })

    const tools: Record<string, CoreTool> = props.tools
      ? props.tools.reduce((obj, name) => {
        const tool = env.useTool(name)
        return { ...obj, [tool.name]: {
          desciption: tool.description,
          parameters: tool.params,
          execute: tool.invoke
        } }
      }, {})
      : {}

    const opts = {
      model: env.useLanguageModel(props.model),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      ...props.options
    }

    async function streamPromise(): Promise<GenerateTextResult<typeof tools>> {
      return new Promise(async (resolve) => {
        const { textStream } = await streamText({
          ...opts,
          onFinish: (res) => resolve(res as GenerateTextResult<typeof tools>)
        })

        for await (const chunk of textStream) {
          stream.push(chunk)
        }
      })
    }

    const response = await (props.stream
      ? streamPromise()
      : generateText(opts)
    )

    ctx.pushResponseMeta('ai', response)
    return { type: 'primitive', value: response.text }
  }
})
