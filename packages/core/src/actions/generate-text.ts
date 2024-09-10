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
  execute: async function({ props, input, results, runtime, stream }) {
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
      ...props.options
    }

    const { text, usage } = props.stream === false
      ? await generateText(opts)
      : await new Promise<{ text: string, usage: CompletionTokenUsage }>(async resolve => {
        const { textStream } = await streamText({
          ...opts,
          temperature: 1,
          onFinish: resolve
        })

        for await (const chunk of textStream) {
          // todo - need a cleaner way to stream - maybe just send events to the controller?
          stream.push(chunk)
        }
      })

    return {
      result: { type: 'native', value: text },
      meta: { usage },
    }
  }
})
