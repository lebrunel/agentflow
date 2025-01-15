import { confirm, editor } from '@inquirer/prompts'
import { dedent as dd } from 'ts-dedent'
import pc from 'picocolors'

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
    console.log(brief)

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
