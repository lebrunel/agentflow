import { defineConfig } from '@ada/core'
import { ollama } from 'ollama-ai-provider'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

export default defineConfig({
  providers: {
    ollama,
    openai,
    anthropic
  }
})
