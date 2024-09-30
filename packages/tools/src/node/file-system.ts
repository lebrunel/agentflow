import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { defineTool, type Tool } from '@agentflow/core'

export function createFileSystemTools(baseDir: string): Record<string, Tool> {
  return [
    defineTool({
      name: 'write_files',
      description: 'Use this tool to create or update one or more files with the given contents. The tool will create all necessary parent directories if they don\'t exist.',
      params: z.object({
        files: z.record(z.string()).describe(
          'An object where keys are full file paths, relative to the base directory, and values are the contents to those files.'
        ),
      }),
      invoke: async ({ files }) => {
        for (const [path, contents] of Object.entries(files)) {
          const filePath = join(baseDir, path)
          mkdirSync(dirname(filePath), { recursive: true })
          writeFileSync(filePath, contents, { encoding: 'utf8' })
        }
        return 'ok'
      }
    })
  ].reduce((obj, tool) => {
    return { ...obj, [tool.name]: tool }
  }, {})
}
