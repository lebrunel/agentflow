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
  name: 'generate-text',
  schema,
  execute: async function(props, { input, results, meta, runtime, stream }) {
    const messages: CoreMessage[] = []
    const tools: Record<string, CoreTool> = props.tools
      ? props.tools.reduce((obj, name) => {
        const tool = runtime.useTool(name)
        return { ...obj, [tool.name]: {
          desciption: tool.description,
          parameters: tool.params,
          execute: tool.invoke
        } }
      }, {})
      : {}

    for (const res of results) {
      messages.push(await toCoreMessage('user', res.input))
      messages.push(await toCoreMessage('assistant', [res.output]))
    }
    messages.push(await toCoreMessage('user', input))

    const opts = {
      model: runtime.useLanguageModel(props.model),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      ...props.options
    }

    const { text, usage } = props.stream === false
      ? await generateText(opts)
      : await new Promise<GenerateTextResult<typeof tools>>(async resolve => {
        const { textStream } = await streamText({
          ...opts,
          onFinish: (result) => resolve(result as GenerateTextResult<typeof tools>)
        })

        for await (const chunk of textStream) {
          // todo - need a cleaner way to stream - maybe just send events to the controller?
          stream.push(chunk)
        }


      })

    meta.usage = usage

    return { type: 'primitive', value: text }
  }
})
