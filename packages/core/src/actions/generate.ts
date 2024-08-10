import { Type, type Static, type TSchema } from '@sinclair/typebox'
import { generateText, streamText, experimental_createProviderRegistry as createProviderRegistry } from 'ai'
import { openai } from '@ai-sdk/openai'
import { ollama } from 'ollama-ai-provider'
import { pushable } from 'it-pushable'
import { Action } from '../action'
import { dd } from '../util'

import type { RootContent } from 'mdast'
import type { CoreMessage } from 'ai'
import type { ActionProps, ActionResult } from '../action'
import type { ActionNode } from '../ast'
import type { ContextValueMap } from '../context'

import TextDecoderStream from 'polyfill-text-decoder-stream'
global.TextDecoderStream = TextDecoderStream

export class GenerateAction extends Action<Props> {
  schema = GenerateProps

  constructor(node: ActionNode<Props>, content: RootContent[]) {
    super(node, content)

    if (this.props.stream !== false) {
      this.stream = pushable({ objectMode: true })
    }
  }

  async execute(context: ContextValueMap, prevResults: ActionResult[]): Promise<ActionResult> {
    const input = this.getContent(context)
    const messages: CoreMessage[] = []
    
    for (const res of prevResults) {
      // todo - better handling of context value to messages
      messages.push({ role: 'user', content: [res.input as any] })
      messages.push({ role: 'assistant', content: [res.output as any] })
    }

    messages.push({ role: 'user', content: [{ type: 'text', text: input }]})

    const opts = {
      model: ollama('llama3.1'),
      system: SYSTEM_PROMPT,
      messages,
    }

    const { text, usage } = this.props.stream === false
      ? await generateText(opts)
      : await new Promise<{ text: string, usage: any }>(async resolve => {
        const { textStream } = await streamText({
          ...opts,
          onFinish: event => resolve(event)
        })

        for await (const chunk of textStream) {
          this.stream!.push(chunk)
        }
      })

    return {
      type: 'generate',
      name: this.name,
      input: { type: 'text', text: input },
      output: { type: 'text', text: text },
      usage: usage,
    }
  }
}

export const registry = createProviderRegistry({
  ollama,
  openai,
})

const SYSTEM_PROMPT = dd`
You are an AI-powered interpreter for a markdown-based workflow system. Your primary function is to execute and respond to individual actions within a workflow phase.

## Key Concepts:
- Workflow: A series of tasks written in plain English, formatted in markdown.
- Phase: A distinct section of a workflow, containing one or more actions.
- Action: A specific task or instruction within a phase.

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
- Use markdown syntax when appropriate (e.g., for code blocks, lists, or emphasis).
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

// Schema

const GenerateProps = Type.Object({
  model: Type.String(),
  stream: Type.Optional(Type.Boolean()),
})

// Types

type Props = ActionProps & Static<typeof GenerateProps>

//export interface GenerateActionResult extends ActionResult {
//  type: 'generate';
//  usage: CompletionTokenUsage;
//}

