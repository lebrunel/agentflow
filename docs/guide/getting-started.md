---
description: Learn how to create, configure, and run AI workflows with Agentflow. Step-by-step guide for setting up your first project and workflow using the command line interface.
---

# Getting started

To use Agentflow, you don't need to be a professional programmer or know any programming languages. But you should be happy working in the command line, and it helps to be able to *think* a little like a programmer - to have a curious and analytical mind, and enjoy solving problems.

## Create an Agentflow project

To use Agentflow, you'll need a JavaScript environment installed on your machine (such as [Node.js](https://nodejs.org) or [Bun](https://bun.sh/)), then use your preferred package manager to bootstrap a new project. You can optionally specify the project name via additional command line options.<br>
*(Using `.` for the project name will scaffold the project in the current directory)*

::: code-group
```sh [npm]
npm create agentflow@latest my-agents
```
```sh [yarn]
yarn create agentflow my-agents
```
```sh [bun]
bun create agentflow my-agents
```
:::

Follow the on-screen prompts, and once the initialiser is finished, change into the project directory and install the dependencies.

::: code-group
```sh [npm]
cd my-agents
npm i
```
```sh [yarn]
cd my-agents
yarn
```
```sh [bun]
cd my-agents
bun i
```
:::

## Project structure

Initialising a new project results in folder structure including the following key files and folders.

- `📂 flows` - The folder in which all your workflows will be created and kept.
- `📂 outputs` - The folder where the results of your workflow executions will be stored.
- `.env` - An environment file, in which to store secrets such as AI provider API keys.
- `agentflow.config.js` - The configuration file for your Agentflow project.

```
my-agents/
├── flows/
│   └── hello-world.mdx
├── outputs/
├── .env
├── agentflow.config.js
└── package.json
```

## Command line interface

In a project where `Agentflow` is installed, you can use the `aflow` binary to create, manage and execute workflows in your project. Use the `aflow help` command to see a list of available commands.

::: code-group
```sh [npm]
npx aflow help
```
```sh [yarn]
yarn run aflow help
```
```sh [bun]
bunx aflow help
```
:::

Learn more about the [command line interface](/guide/cli).

## Project configuration

When running `aflow` from the command line, Agentflow will try to find and load a config file named `agentflow.config.js` (or `.ts`) from the project root. If there is also a `.env` file present, this is loaded first and all defined environment variables can be accessed on `process.env`.

```ts
import { defineConfig } from '@agentflow/core'
import { createOpenAI } from '@ai-sdk/openai'

export default defineConfig({
  providers: {
    openai: createOpenAI({
      apiKey: process.env.MY_OPENAI_KEY
    })
  }
})
```

Learn more about the [configuring Agentflow](/guide/configuration).

## Your first workflow

#todo

- using cli to generate workflow
- writing workflow (link to structure)
- using cli to execute workflow
