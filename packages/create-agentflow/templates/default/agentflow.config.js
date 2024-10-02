import { defineConfig } from '@agentflow/core'
import { openai } from '@ai-sdk/openai'

export default defineConfig({
  providers: {
    openai
  }
})
