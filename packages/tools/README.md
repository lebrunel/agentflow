# Agentflow Tools `@agentflow/tools`

![NPM Version](https://img.shields.io/npm/v/%40agentflow%2Ftools?style=flat-square)
![NPM License](https://img.shields.io/npm/l/%40agentflow%2Ftools?style=flat-square)

Agentflow library of function-calling tools for enhancing LLM capabilities in your workflows.

`@agentflow/tools` provides a collection of tools designed to extend the capabilities of Large Language Models (LLMs) that support function calling. This package enhances the capabilities of Agentflow workflows with powerful, pre-built functionality.

> [!NOTE]
> This package is in early development. Currently it provides file system tools, with more tools planned for future releases.

## Installation

Install the package alongside AgentFlow core:

```sh
npm install @agentflow/tools
```

## Usage

Configure tools in your project's `agentflow.config.js`:

```ts
import { join } from 'node:path'
import { defineConfig } from '@agentflow/core'
import { createFileSystemTools } from '@agentflow/tools'

// Configure file system tools with a base directory
const baseDir = join(process.cwd(), 'outputs')
const fs = createFileSystemTools(baseDir)

export default defineConfig({
  tools: [
    fs.write_files
  ],

  // other config options
})
```

Available tools:

- `write_files` - Enables LLMs to write files to your local file system

## Documentation

For complete documentation, visit [agentflow.2point0.ai](https://agentflow.2point0.ai).

## License

This package is open source and released under the [Apache-2 Licence](https://github.com/lebrunel/agentflow/blob/master/LICENSE).

© Copyright 2024 [Push Code Ltd](https://www.pushcode.com/).
