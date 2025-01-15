import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Command } from 'commander'
import { kebabCase } from 'change-case'
import { dedent as dd } from 'ts-dedent'
import { automagicWorkflow } from './helpers/automagic'

const cmd = new Command()
  .name('new')
  .alias('n')
  .description('create a new workflow')
  .argument('<name>', 'name of the workflow')
  .option('--auto', '✨ auto generate the workflow ✨', false)
  .option('-f, --force', 'overwrite existing workflow', false)
  .action(createWorkflow)

async function createWorkflow(name: string, opts: { auto: boolean, force: boolean }) {
  const cwd = process.cwd()

  const fileName = kebabCase(name) + '.mdx'
  const flowPath = join(cwd, 'flows')
  const filePath = join(flowPath, fileName)

  //if (!existsSync(flowPath)) {
  //  throw new Error(`Directory does not exist: ${flowPath}`)
  //} else if (existsSync(filePath) && !opts.force) {
  //  throw new Error(`Workflow file already exists: ${fileName}`)
  //} else {
    const workflow = opts.auto
      ? await automagicWorkflow(name)
      : workflowTemplate(name)

    //writeFileSync(filePath, workflow, { encoding: 'utf8' })
  //}
}

function workflowTemplate(name: string) {
  return dd`
  ---
  input:
    # Define your workflow's inputs here
    # example:
    # content:
    #   type: text
    #   message: "Enter the content to process"
  ---

  # ${name}

  > This is your new workflow! Here's how to get started:
  >
  > 1. Replace this block with a clear description of what this workflow aims to achieve
  > 2. Define any input data your workflow needs in the frontmatter
  > 3. Break your workflow into logical phases using horizontal rules (\`---\`)
  > 4. Write your prompts in natural language
  > 5. Add AI actions like \`<GenText />\` and \`<GenObject />\` to generate content
  >
  > Need help? Check out:
  > - 📖 [Workflow Structure Guide](https://agentflow.2point0.ai/guide/workflow-structure.html)
  > - 🤖 [AI Generation Guide](https://agentflow.2point0.ai/guide/ai-generations.html)
  > - 🔄 [Control Flow Guide](https://agentflow.2point0.ai/guide/control-flow.html)

  ---

  Start writing your workflow here...

  <GenText as="output" model="openai:gpt-4o" />
  `
}

export default cmd


// dream mode
// lazy mode
// wingman
