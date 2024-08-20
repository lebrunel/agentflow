import { defineConfig } from '@ada/core'
import { ollama } from 'ollama-ai-provider'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

console.log('ENV1', process.env)

export default defineConfig({
  providers: {
    ollama,
    openai,
    anthropic
  }
})

console.log('ENV2', process.env)