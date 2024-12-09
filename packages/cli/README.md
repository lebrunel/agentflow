# Agentflow CLI `@agentflow/cli`

![NPM Version](https://img.shields.io/npm/v/%40agentflow%2Fcli?style=flat-square)
![NPM License](https://img.shields.io/npm/l/%40agentflow%2Fcli?style=flat-square)

Command-line interface for Agentflow, providing essential tools to create, manage, and execute AI-powered workflows.

`@agentflow/cli` is the primary interface for interacting with Agentflow, offering developers and users a powerful and user-friendly command-line tool set.

## Installation

The CLI can be installed globally:

```sh
npm install -g @agentflow/cli
```

Or locally as a project dependency:

```sh
npm install @agentflow/cli
```

## Usage

Common commands:

- `aflow help` - Display help information
- `aflow init` - Create a new project
- `aflow list` - List available workflows
- `aflow exec` - Execute a workflow

Example:

```sh
# Create a new Agentflow project
aflow init my-project
cd my-project && npm install

# Execute a workflow
aflow exec hello-world
```

## Documentation

For complete documentation, visit [agentflow.2point0.ai](https://agentflow.2point0.ai).

## License

This package is open source and released under the [Apache-2 Licence](https://github.com/lebrunel/agentflow/blob/master/LICENSE).

© Copyright 2024 [Push Code Ltd](https://www.pushcode.com/).
