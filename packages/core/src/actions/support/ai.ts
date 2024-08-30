import { z } from 'zod'
import { default as dd } from 'ts-dedent'

import type { CoreAssistantMessage, CoreUserMessage } from 'ai'
import type { ContextValue } from '../../context'

export const SYSTEM_PROMPT = dd`
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

export const aiGenerationOptions = z.object({
  maxTokens: z.number().gt(0).optional(),
  temperature: z.number().min(0).max(1).default(0.5),
  seed: z.number().optional(),
  stop: z.union([
    z.string().transform(val => val.split(',').map(v => v.trim())),
    z.array(z.string()),
  ]).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().min(0).max(1).optional(),
  presencePenalty: z.number().min(-1).max(1).optional(),
  frequencyPenalty: z.number().min(-1).max(1).optional(),
})

export function toCoreMessage(
  role: 'user' | 'assistant',
  values: ContextValue[],
): CoreUserMessage | CoreAssistantMessage {
  const content = values.map(ctx => {
    if (ctx.type === 'image') {
      const data = Buffer.from(ctx.value.data).toString('base64')
      return { type: 'image', image: `data:${ctx.value.type};base64,${data}` }
    } else {
      return { type: 'text', text: ctx.value }
    }
  })

  if (role === 'user') {
    return { role, content } as CoreUserMessage
  } else {
    // For 'assistant', we assume only text content is allowed
    return { role, content } as CoreAssistantMessage
  }
}