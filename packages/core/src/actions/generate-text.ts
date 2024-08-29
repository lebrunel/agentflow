import { z } from 'zod'
import { generateText, streamText } from 'ai'
import { defineAction } from '../action'
import { aiGenerationOptions, toCoreMessage, SYSTEM_PROMPT } from'./support/ai'

import type { CompletionTokenUsage, CoreMessage } from 'ai'

const schema = z.object({
  model: z.string(),
  stream: z.boolean().optional(),
  tools: z.array(z.string()).optional(),
  options: aiGenerationOptions.default({})
})

export default defineAction({
  name: 'generate-text',
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
      ...action.props.options
    }

    const { text, usage } = action.props.stream === false
      ? await generateText(opts)
      : await new Promise<{ text: string, usage: CompletionTokenUsage }>(async resolve => {
        const { textStream } = await streamText({
          ...opts,
          temperature: 1,
          onFinish: resolve
        })

        for await (const chunk of textStream) {
          stream.push(chunk)
        }
      })

    return {
      output: { type: 'text', value: text },
      usage,
    }
  }
})
