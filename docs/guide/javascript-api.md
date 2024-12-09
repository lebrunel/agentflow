---
outline: [2,3]
---

# JavaScript API

Agentflow provides a JavaScript API for working with workflows programmatically. This allows you to parse Markdown-formatted workflows and execute them directly from your code.

> [!WARNING] ⚠️ Warning
> Agentflow is a new project and the JavaScript API is subject to change as the project evolves. We recommend checking the documentation when upgrading to new versions for any breaking changes.

## Installation

Install the Agentflow core package using your favoured package manager:

::: code-group
```sh [npm]
npm install @agentflow/core
```
```sh [yarn]
yarn add @agentflow/core
```
```sh [bun]
bun install @agentflow/core
```
:::

## Usage

### Workflow compilation

A `Workflow` instance represents a parsed and validated workflow definition. It contains the workflow's structure, metadata, and provides methods for execution. To create a workflow instance, compile a Markdown-formatted string:

```ts
import { Environment, Workflow } from '@agentflow/core'

const env = new Environment({
  providers: {
    // configure AI providers
  }
})

const markdown = `
# Joke generator

Tell me the corniest dad joke you can think of.

<GenText as="joke" model="openai:gpt-4o-mini" />`

const workflow = Workflow.compileSync(markdown, env)
```

### Workflow execution

Workflows are executed step by step, with each step potentially involving AI interactions, loops, or other actions. The `ExecutionController` manages this process and provides real-time updates through events.

```ts
// Create a new execution controller
const ctrl = workflow.createExecution({
  // Optional: provide initial context values
  name: { type: 'primitive', value: 'Joe Bloggs' }
})

// Step events are emitted at the start of each step
ctrl.on('step', (step, event, cursor) => {
  // Each step event provides:
  // - step: the current workflow step
  // - event: contains the action promise and any streaming data
  // - cursor: the current position in the workflow

  console.log(`Executing step: ${cursor.toString()}`)

  // If the step has an action, we can access its result
  event.action?.then(({ result }) => {
    console.log(result)
  })
})

// Emitted when the workflow completes
ctrl.on('complete', (output) => {
  console.log('Workflow completed:')
  console.log(output)
})

// Emitted if an error occurs during execution
ctrl.on('error', (error) => {
  console.error('Workflow error:', error)
})

// Start the workflow
await controller.runAll()
```

The `ExecutionController` emits events that allow you to monitor the workflow's progress and handle any errors that occur during execution. It also provides methods for pausing and rewinding execution, allowing for advanced, fine-grained control of the workflow's execution process.
