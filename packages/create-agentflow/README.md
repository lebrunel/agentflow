# Agentflow Starter Kit `create-agentflow`

![NPM Version](https://img.shields.io/npm/v/create-agentflow?style=flat-square)
![NPM License](https://img.shields.io/npm/l/create-agentflow?style=flat-square)

The recommended way to quickly set up and bootstrap Agentflow projects.

`create-agentflow` is a project template designed to streamline the process of setting up new Agentflow projects. This package serves as the entry point for developers and users looking to quickly get started with Agentflow.

## Installation

The starter kit is used via your preferred package manager's `create` command:

```sh
# Using NPM
npm create agentflow@latest my-project

# Using Yarn
yarn create agentflow my-project

# Using Bun
bun create agentflow my-project
```

## Usage

1. Run the create command:

  ```sh
  npm create agentflow@latest my-project
  ```

2. Follow the interactive prompts to configure your project.

3. Once complete, navigate to your project and install dependencies:

  ```sh
  cd my-project
  npm install
  ```

4. Configure your project:

  - Add your AI provider settings in `agentflow.config.js`
  - Set up your API keys in the `.env` file

The starter kit creates a project with:

- Basic project structure
- Configuration file templates
- Example workflows
- Local CLI installation
- All necessary dependencies

## Documentation

For complete documentation, visit [agentflow.2point0.ai](https://agentflow.2point0.ai).

## License

This package is open source and released under the [Apache-2 Licence](https://github.com/lebrunel/agentflow/blob/master/LICENSE).

© Copyright 2024 [Push Code Ltd](https://www.pushcode.com/).
