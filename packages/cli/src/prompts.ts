import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { lookup } from 'mime-types'
import { createPrompt, isEnterKey, usePrefix, useState, useKeypress } from '@inquirer/core'
import { input, editor, select } from '@inquirer/prompts'
import type {
  ContextValue,
  ContextValueMap,
  WorkflowInputs,
  TextInputSchema,
  SelectInputSchema,
  ArrayInputSchema,
  FileInputSchema,
} from '@ada/core'
import { blue, bold, dim } from 'picocolors'

export async function promptInputs(inputs: WorkflowInputs): Promise<ContextValueMap> {
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

export async function promptText(name: string, schema: TextInputSchema): Promise<ContextValue> {
  const message = schema.message || `Enter ${name}`
  const text = await (schema.multiline ? editor({ message }) : input({ message }))
  return { type: 'text', text }
}

export async function promptSelect(name: string, schema: SelectInputSchema): Promise<ContextValue> {
  const message = schema.message || `Select ${name}`
  const choices = schema.choices.map(choice => {
    if (typeof choice === 'string') {
      return { value: choice }
    } else {
      return choice
    }
  })
  
  const text = await select({ message, choices })
  return { type: 'text', text }
}

export async function promptFile(name: string, schema: FileInputSchema): Promise<ContextValue> {
  const message = schema.message || `Enter ${name}`
  const value = await input({ message, validate: isUrlOrPath })

  if (schema.fileType === 'image') {
    const blob = isUrl(value)
      ? await fetch(value).then(r => r.blob())
      : readFileAsBlob(resolve(process.cwd(), value))
    
    return {
      type: 'image',
      image: URL.createObjectURL(blob),
      digest: 'a hash', // todo - define way to calculate quick digests
    }
  } else {
    const text = isUrl(value)
      ? await fetch(value).then(r => r.text())
      : readFileSync(resolve(process.cwd(), value), { encoding: 'utf8' })

    return {
      type: 'text',
      text,
    }
  }
}

export async function promptArray(name: string, schema: ArrayInputSchema): Promise<ContextValue> {
  const message = schema.message || `Enter ${name}`
  const res = await multiline({ message })
  // todo - we need an array context type
  return { type: 'text', text: '' }
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

function readFileAsBlob(path: string): Blob {
  const buffer = readFileSync(path)
  const type = lookup(path) || 'application/octet-stream'
  return new Blob([buffer], { type })
}
