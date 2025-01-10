import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import merge from 'deepmerge'
import fg from 'fast-glob'
import type { UserConfig } from '@agentflow/core'

const CONFIG_FILE_BASE_NAME = 'agentflow.config'
const CONFIG_FILE_EXTS = ['js', 'mjs', 'ts']

export async function resolveConfig(baseDir: string): Promise<UserConfig> {
  let userConfig: UserConfig = {}
  let configPath: string | undefined

  for (const ext of CONFIG_FILE_EXTS) {
    configPath = resolve(baseDir, `${CONFIG_FILE_BASE_NAME}.${ext}`)

    if (existsSync(configPath)) {
      const config = await import(configPath)
      userConfig = config.default || config
      break
    }
  }

  const prompts = () => {
    const promptsDir = resolve(baseDir, 'prompts')
    return fg.sync(resolve(promptsDir, '**/*.mdx')).reduce((obj, path) => {
      const relativePath = relative(promptsDir, path)
      obj[relativePath] = readFileSync(path, { encoding: 'utf8' })
      return obj
    }, {} as Record<string, string>)
  }

  return merge<UserConfig>({ prompts }, userConfig)
}
