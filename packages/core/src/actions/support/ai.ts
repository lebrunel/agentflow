import { z } from 'zod'
import { dedent as dd } from 'ts-dedent'
import { tool } from 'ai'
import { stringifyContext } from '../../ast'

import type { CoreAssistantMessage, CoreUserMessage, CoreTool } from 'ai'
import type { ContextValue } from '../../context'
import type { Tool } from '../../tool'

export const aiGenerationOptions = z.object({
  maxTokens: z.number().gt(0).optional(),
  temperature: z.number().min(0).max(1).default(0.5),
  seed: z.number().optional(),
  stop: z.array(z.string()).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().min(0).max(1).optional(),
  presencePenalty: z.number().min(-1).max(1).optional(),
  frequencyPenalty: z.number().min(-1).max(1).optional(),
})

export function createSystemPrompt(role?: string): string {
  return dd`
  You are an AI-powered interpreter for a markdown-based workflow system. Your primary function is to execute and respond to individual actions within a workflow phase.

  ## Your Role:

  ${role
    ? `You have been assigned a specific role with the following characteristics:\n\n${role}\n\nIn addition to this role, you must:`
    : 'You must:'
  }

  1. Interpret and execute each action presented by the user.
  2. Provide direct, accurate, and detailed responses to each action.
  3. Utilize available tools when necessary to generate appropriate responses.

  ## Important Guidelines:

  - This is not a conversational interface. Your responses will be interpolated directly into the user's markdown document.
  - Adhere closely to the user's instructions for each action.
  - Maintain a focus on the current action. Do not reference previous or future actions unless explicitly instructed.
  - Provide detailed responses when the action requires it, but always be concise and avoid unnecessary verbosity.
  - If an action is unclear or impossible to execute, request clarification in a concise manner.
  ${role ? '- Ensure all responses align with your assigned role while following these guidelines.' : ''}

  ## Response Format:

  - Provide only the result of the action, with no extraneous information.
  - Do not include any explanations, introductions, or conclusions.
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
}

export async function toCoreMessage(
  role: 'user' | 'assistant',
  context: ContextValue | ContextValue[],
): Promise<CoreUserMessage | CoreAssistantMessage> {
  if (!Array.isArray(context)) return toCoreMessage(role, [context])
  const content = []

  for (const ctx of context) {
    if (ctx.type === 'file') {
      const image = await getDataUrlFromFile(ctx.value)
      content.push({ type: 'image', image })
    } else {
      const text = stringifyContext(ctx)
      content.push({ type: 'text', text })
    }
  }

  return { role, content } as CoreUserMessage | CoreAssistantMessage
}

export function toCoreTool<T extends z.ZodType>(options: Tool<T>): CoreTool<T> {
  const { description, params: parameters, invoke: execute } = options
  return tool({ description, parameters, execute })
}

async function getDataUrlFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const base64 = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), '' as string))
  return `data:${file.type};base64,${base64}`
}
