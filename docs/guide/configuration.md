---
description: Learn how to configure Agentflow projects. Set up AI providers, custom actions, tools, and plugins for your workflows.
outline: [2,3]
---

# Configuration

Agentflow projects can be configured by creating an `agentflow.config.js` file in your project's root directory. This configuration defines the environment in which your workflows are executed, including AI providers, custom actions, tools, and plugins.

> [!WARNING] ⚠️ Warning
> Agentflow is a new project and the configuration API is highly likely to change as the project evolves. We recommend checking the documentation when upgrading to new versions for any breaking changes.

## Basic Configuration

Create an `agentflow.config.js` file in your project root:

```js
import { defineConfig } from '@agentflow/core'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

import { debugAction, writeFileTool } from './lib/custom'

export default defineConfig({
  // Register custom actions
  actions: [
    debugAction
  ],

  // Register tools for LLM actions
  tools: [
    writeFileTool
  ],

  // Register LLM providers (compatible with Vercel AI SDK)
  providers: {
    openai,
    anthropic: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  },

  // Add Agentflow plugins
  plugins: [],

  // Add custom workflow validators
  validators: []
})
```

## Configuration Options

### `actions`

Register custom actions for use in your workflows. Actions are components that work on input and generate a result. Agentflow includes several built-in actions (`<GenText />`, `<GenObject />`, `<Loop />`, and `<Cond />`), and you can create your own using the `defineAction` function.

### `tools`

Register tools that can be used by LLM actions (`<GenText />` and `<GenObject />`). Tools can be defined using the `defineTool` function, and any tools compatible with Vercel's AI SDK can also be used.

### `providers`

Register AI providers that will be available to your workflows. Agentflow uses Vercel's AI SDK for provider compatibility, meaning you can use any provider that works with the AI SDK.

### `plugins`

Register plugins that can extend the Agentflow environment. A plugin is a function that receives the Environment object and can add its own actions, tools, or providers.

### `validators`

Add custom validation rules for workflow ASTs. These validators run when a workflow is compiled and can be used to enforce specific requirements or constraints.

## Environment Variables

Agentflow will automatically load environment variables from a `.env` file in your project's root directory. This is particularly useful for storing sensitive information like API keys that shouldn't be committed to version control.

```sh
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
```

These variables are accessible via `process.env` in your configuration file, as shown in the example above where we configure the Anthropic provider.
