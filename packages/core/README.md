# Agentflow Core `@agentflow/core`

![NPM Version](https://img.shields.io/npm/v/%40agentflow%2Fcore?style=flat-square)
![NPM License](https://img.shields.io/npm/l/%40agentflow%2Fcore?style=flat-square)

Agentflow compiler and execution engine, enabling AI-powered workflows and automations using Markdown and natural language.

`@agentflow/core` is the heart of the Agentflow framework. This package is responsible for transforming human-readable, Markdown-based text files into fully executable workflows.

## Installation

Install the package using your preferred package manager:

```sh
npm install @agentflow/core
```

## Usage

Here's a simple example demonstrating how to compile and execute a workflow programmatically:

```ts
import { Environment, Workflow } from '@agentflow/core'
import { openai } from '@ai-sdk/openai'

// Initialize environment with AI providers
const env = new Environment({
  providers: {
    openai
  }
})

// Compile a workflow
const workflow = Workflow.compileSync(`
  Write a short story about {topic}.

  <GenText as="story" model="openai:gpt-4o" />
`, env)

// Create and run execution
const ctrl = workflow.createExecution({
  topic: { type: 'primitive', value: 'a magical forest' }
})

// Handle execution events
ctrl.on('step', (step, event) => {
  event.action?.then(({ result }) => console.log(result))
})

ctrl.on('complete', (output) => {
  console.log('Done!\n', output)
})

// Run the workflow
await ctrl.runAll()
```

The core package provides:

- Workflow compiler and parser
- Execution engine with event system
- Built-in actions (`<GenText />`, `<GenObject />`, `<Loop />`, `<Cond />`)
- Environment configuration
- TypeScript types and utilities

## Documentation

For complete documentation, visit [agentflow.2point0.ai](https://agentflow.2point0.ai).

## License

This package is open source and released under the [Apache-2 Licence](https://github.com/lebrunel/agentflow/blob/master/LICENSE).

© Copyright 2024 [Push Code Ltd](https://www.pushcode.com/).
