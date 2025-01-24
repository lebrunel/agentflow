import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { confirm, editor, input } from '@inquirer/prompts'
import { dedent as dd } from 'ts-dedent'
import { streamText, tool } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { ollama } from 'ollama-ai-provider'
import { z } from 'zod'
import pc from 'picocolors'

const anthropic = createAnthropic({
  apiKey: 'key-here'
})

const openai = createOpenAI({
  apiKey: 'key-here'
})

export async function automagicWorkflow(name: string) {
  const toProceed = await confirm({
    message: USER_INITIAL_PROMPT,
    theme: {
      prefix: '✨',
      style: {
        message: (text: string) => text,
      }
    }
  })
  if (toProceed) {
    const brief = await editor({
      message: '',
      default: DEFAULT_BRIEF_TEMPLATE,
      postfix: '.md',
      waitForUseInput: false,
    })

    const systemPrompt = readFileSync(resolve(__dirname, 'automagic', 'system.mdx'), { encoding: 'utf8' })
      .replace('${AVAILABLE_TOOLS}', 'None')
      .replace('${AVAILABLE_MODELS}', 'openai:gpt-4o')

    const instructPrompt = readFileSync(resolve(__dirname, 'automagic', 'prompt.mdx'), { encoding: 'utf8' })
      .replace('${USER_BRIEF}', brief)
      .replace('${AVAILABLE_MODELS}', 'openai:gpt-4o')

    const { textStream, usage } = streamText({
      model: anthropic('claude-3-5-sonnet-latest'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instructPrompt },
      ],
      tools: {
        ask_user: askUserTool,
        save_workflow: saveWorkflowTool,
      },
      maxSteps: 20,
    })

    for await (const chunk of textStream) {
      process.stdout.write(chunk)
    }

    console.log()
    console.log('Wooooo!')
    usage.then(console.log)


    // TODO
    // send detailed instructions and brief to o1
    // tools:
    // - ask_question (think a bit about how this is prompted in terminal)
    // - save_workflow
    // o1 may "ask questions" if needed
    // o1 then saves workflow
    // we attempt to compile and respond with errors
    // 01 tries again
    // we save final output to disk
  }
}

const askUserTool = tool({
  description: 'Ask the user a question?',
  parameters: z.object({
    question: z.string().describe('The question to put to the user')
  }),
  execute: async ({ question }) => {
    console.log()
    return input({
      message: question,
      required: true,
      theme: {
        prefix: '🙋🏻',
        style: {
          message: (text: string) => text,
        }
      }
    })
  }
})

const saveWorkflowTool = tool({
  description: 'Validate and save the workflow. Returns with a success message or validation errors.',
  parameters: z.object({
    filename: z.string().describe('Filename for the workflow, must have .mdx extension.'),
    contents: z.string().describe('The text contents of the workflow.')
  }),
  execute: async ({ contents }) => {
    console.log()
    console.log('Saving', 'name.mdx')
    console.log(contents)
    console.log('~~~~~')
    return 'Success'
  }
})

const USER_INITIAL_PROMPT = dd`
${pc.bold(`Let Agentflow ${pc.italic('automagically')} compose a workflow based on your brief`)}

This is an experimental feature and results may vary. A well-written brief is crucial for getting the best results.

Before proceeding:
- See examples of effective briefs at: ${pc.cyan('http://agentflow.2point0.ai/guide/automagic')}
- Customize the model used with the \`${pc.yellow('--automagic-model')}\` option (defaults to \`${pc.yellow('openai:o1')}\`)
- Ensure the automagic model provider is configured in your project's \`${pc.yellow('agentflow.config.js')}\` file
- Note: Generation with \`${pc.yellow('openai:o1')}\` typically costs between $1.00-$5.00, depending on complexity

When you continue, your default text editor will open with a brief template.
Take your time to think through and describe your workflow's requirements.

Are you ready to continue?
`

const DEFAULT_BRIEF_TEMPLATE = dd`
## What does this workflow do?
[Describe the main purpose and goal]

## What are the inputs?
[What information or data does the workflow need to work with?]

## What should it output?
[What should the workflow produce?]

## Example
[Provide a quick example of how this would be used]
`
