import { join } from 'node:path'
import { createFileSystemTools } from '@agentflow/tools'
import { z } from 'zod'
import { WorkflowInputSchema } from './inputs'
import { promptText, promptSelect, promptFile, promptArray } from './prompts'

import type { ContextValueMap, Plugin, WorkflowMetadata, WorkflowValidator } from '@agentflow/core'

export function createExecutionPlugin({ outputPath }: {
  outputPath: string;
}): Plugin {

  return (env) => {
    const fs = createFileSystemTools(join(outputPath, 'files'))
    env.registerTool(fs.write_files)
    env.validators.push(validateInputs)
  }
}

export async function resolveInputs(meta: WorkflowMetadata): Promise<ContextValueMap> {
  const context: ContextValueMap = {}

  for (const [name, schema] of Object.entries((meta.input || {}) as WorkflowInputSchema)) {
    switch (schema.type) {
      case 'text':
        context[name] = await promptText(name, schema)
        break
      case 'select':
        context[name] = await promptSelect(name, schema)
        break
      case 'file':
        context[name] = await promptFile(name, schema)
        break
      case 'array':
        context[name] = await promptArray(name, schema)
        break
      default:
        throw new Error(`Unrecognised input type: ${JSON.stringify(schema)}`)
    }
  }

  return context
}

const validateInputs: WorkflowValidator = (workflow, file) => {
  if (workflow.ast.children[0].type !== 'yaml') return

  try {
    WorkflowInputSchema.parse(workflow.meta.input || {})
  } catch(e) {
    if (e instanceof z.ZodError) {
      for (const issue of e.issues) {
        file.fail(
          `Invalid input schema at \`${issue.path.join('.')}\`. ${issue.message}`,
          workflow.ast.children[0],
          'workflow-parse:invalid-input-schema'
        )
      }
    }
  }
}
