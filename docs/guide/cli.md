---
outline: [2,3]
---

# Command line interface

The Agentflow CLI is the easiest way to work with Agentflow projects. It provides commands for creating new projects, listing available workflows, and executing workflows with AI agents.

## Installation

> [!NOTE] 🎓 Info
> If you created your project using `npm create agentflow`, the CLI is already installed locally as a project dependency. You can run it using your package manager (e.g., `npm run aflow [command]` or `yarn aflow [command]`).
>
> The examples in this documentation use the globally installed CLI (`aflow [command]`) for brevity, but both approaches work identically.

Install the Agentflow CLI globally using your favoured package manager:

::: code-group
```sh [npm]
npm install -g @agentflow/cli
```
```sh [yarn]
yarn global add @agentflow/cli
```
```sh [bun]
bun install -g @agentflow/cli
```
:::

## Commands

### `init` - Create a new project

Initialised a new Agentflow project in a specified directory.

```sh
aflow init [path] [options]
# or
aflow i [path] [options]
```

#### Arguments:

- `path`: *(Optional)*. The directory where the project will be created. If not specified, creates a new project in the current directory.

#### Options:

- `-t, --template <name>`: Specify a project template *(optional)*.

### `list` - List workflows

Display all available workflows in the current project.

```sh
aflow list
# or
aflow ls
```

This command scans the project's workflows directory and displays a list of all available workflows with their IDs and titles.

### `exec` - Execute workflow

Execute a specific workflow.

```sh
aflow exec <workflow>
# or
aflow x <workflow>
```

#### Arguments:

- `workflow`: Name of the workflow to execute *(required)*.

The execution command loads and runs the specified workflow, prompting for any required user inputs along the way. Progress and outputs are streamed to the console in real-time. All execution results, including the final output and any files generated during the workflow, are automatically saved to a timestamped directory within your project's `/outputs` folder.
