import { z } from 'zod'
import { generateText, streamText } from 'ai'
import type { CompletionTokenUsage, CoreMessage, UserContent } from 'ai'

import { defineAction } from '../runtime/action'
import { dd } from '../util'
import type { ContextValue } from '../workflow/context'

const schema = z.object({
  model: z.string(),
  stream: z.optional(z.boolean())
})

export const generateTextAction = defineAction({
  name: 'GenerateText',
  schema,
  execute: async ({ action, input, results, stream }, runtime) => {
    const messages: CoreMessage[] = []

    for (const res of results) {
      messages.push({ role: 'user', content: contextToContent(res.input) })
      messages.push({ role: 'assistant', content: [{
        type: 'text',
        text: res.output.value,
      }] })
    }
    messages.push({ role: 'user', content: contextToContent(input) })

    const opts = {
      model: runtime.useLanguageModel(action.props.model),
      system: SYSTEM_PROMPT,
      messages,
    }

    const { text, usage } = action.props.stream === false
      ? await generateText(opts)
      : await new Promise<{ text: string, usage: CompletionTokenUsage }>(async resolve => {
        const { textStream } = await streamText({
          ...opts,
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

function contextToContent(values: ContextValue[]): UserContent {
  return values.map(ctx => {
    if (ctx.type === 'image') {
      const data = Buffer.from(ctx.value.data).toString('base64')
      return { type: 'image', image: `data:${ctx.value.type};base64,${data}` }
    } else {
      return { type: 'text', text: ctx.value }
    }
  })

}

const SYSTEM_PROMPT = dd`
You are an AI-powered interpreter for a markdown-based workflow system. Your primary function is to execute and respond to individual actions within a workflow phase.

## Your Role:
1. Interpret and execute each action presented by the user.
2. Provide direct, accurate, and detailed responses to each action.
3. Utilize available tools when necessary to generate appropriate responses.

## Important Guidelines:
- This is not a conversational interface. Your responses will be interpolated directly into the user's markdown document.
- Adhere closely to the user's instructions for each action.
- Maintain a focus on the current phase and action. Do not reference previous or future actions unless explicitly instructed.
- Provide detailed responses when the action requires it, but avoid unnecessary verbosity.
- If an action is unclear or impossible to execute, request clarification in a concise manner.

## Response Format:
- Provide only the result of the action, with no extraneous information.
- Do not include any explanations, introductions, or conclusions.
- Use markdown syntax when appropriate.
- If the result is empty or null, respond with an empty string.
- For multi-part results, use appropriate markdown structures (lists, tables, etc.) to organize the information clearly.

## Example action and response:
Action: "Generate a list of 3 random fruits"
Response:
- Apple
- Banana
- Mango

Remember, you are interpreting and executing English instructions as if they were code. Precision and accuracy are paramount.
`
