import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { lookup } from 'mime-types'
import { createPrompt, isEnterKey, usePrefix, useState, useKeypress } from '@inquirer/core'
import { input, editor, select } from '@inquirer/prompts'
import { bold, dim } from 'picocolors'
import type {
  ContextValue,
  ContextValueMap,
  ContextImageValue,
  TextInput,
  SelectInput,
  ArrayInput,
  FileInput,
  WorkflowInputSchema
} from '@ada/core'
import type {  } from '@ada/core'

export async function promptInputs(inputs: WorkflowInputSchema): Promise<ContextValueMap> {
  const context: ContextValueMap = {}

  for (const [name, schema] of Object.entries(inputs)) {
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

export async function promptText(name: string, schema: TextInput): Promise<ContextValue> {
  const message = schema.message || `Enter ${name}`
  const value = await (schema.multiline ? editor({ message }) : input({ message }))
  return { type: 'text', value }
}

export async function promptSelect(name: string, schema: SelectInput): Promise<ContextValue> {
  const message = schema.message || `Select ${name}`
  const choices = schema.options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt }
    } else {
      return opt
    }
  })

  const value = await select({ message, choices })
  return { type: 'text', value }
}

export async function promptFile(name: string, schema: FileInput): Promise<ContextValue> {
  const message = schema.message || `Enter ${name}`
  const value = await input({ message, validate: isUrlOrPath })

  if (schema.fileType === 'image') {
    const image: ContextImageValue['value'] = isUrl(value)
      ? await loadRemoteImage(value)
      : loadLocalImage(value)

    // todo - validate that this is in fact an image

    return { type: 'image', value: image }
  } else {
    const text = isUrl(value)
      ? await fetch(value).then(r => r.text())
      : readFileSync(resolve(process.cwd(), value), { encoding: 'utf8' })

    return { type: 'text', value: text }
  }
}

export async function promptArray(name: string, schema: ArrayInput): Promise<ContextValue> {
  const message = schema.message || `Enter ${name}`
  const value = await multiline({ message })
  // todo - we need an array context type
  return { type: 'text', value: '' }
}

const multiline = createPrompt<string[], { message: string }>((config, done) => {
  const prefix = usePrefix({})
  const [values, setValues] = useState<string[]>([])
  const [nextValue, setNextValue] = useState('')

  useKeypress((key, rl) => {
    if (isEnterKey(key)) {
      const val = nextValue.trim()
      if (val === '') {
        done(values)
      } else {
        setValues([...values, ...val.split('\n')])
        setNextValue('')
      }
    } else {
      setNextValue(rl.line)
    }
  })

  const prompt: string[] = [
    `${prefix} ${bold(config.message)} ${dim('(blank line to end)')}`
  ]
  if (values.length) {
    prompt.push('- '+values.join('\n- '))
  }
  prompt.push(`  ${nextValue}`)
  return prompt.join('\n')
})

function isUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function isUrlOrPath(value: string): boolean | string {
  try {
    new URL(value)
    return true
  } catch(e) {
    if (existsSync(resolve(process.cwd(), value))) {
      return true
    }
  }
  return 'must be URL or valid local file path'
}

async function loadRemoteImage(value: string): Promise<ContextImageValue['value']> {
  const url = new URL(value)
  const name = url.pathname.split('/').pop() || 'Unknown'
  const data = await fetch(url).then(r => r.arrayBuffer())
  const type = lookup(name) || 'application/octet-stream' // todo - fallback based on byte prefix
  return { name, type, data: new Uint8Array(data) }
}

function loadLocalImage(path: string): ContextImageValue['value'] {
  const name = basename(path)
  const data = readFileSync(path)
  const type = lookup(path) || 'application/octet-stream' // todo - fallback based on byte prefix
  return { name, type, data: new Uint8Array(data) }
}
