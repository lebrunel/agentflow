---
description: Learn how to generate text and structured data with AI models in Agentflow. Covers text generation, object generation, and configuring AI providers like OpenAI and Anthropic.
---

# AI generations

At its heart, Agentflow is a tool to leverage advanced AI models to generate outputs as part of your workflows. Agentflow provides actions for generating text and structured data, and can be equipped with tools that bring external web services or local files and databases directly into your workflows.

## Text generation

Text generation uses large language models (LLMs) to help you write content and code, plan meetings and write agendas, and even help you research and reason over complex problems.

```mdx
Based on the following research paper, create a concise and detailed
scientific abstract that summarises the research findings:

{research}

<GenText as="abstract" model="anthropic:claude-3-5-sonnet-20240620" />
```

The `<GenText />` action takes all the context immediately prior to the action (including the results of previous actions) and provides it as input to the action. In addition, the `<GenText />` action accepts the following attributes:

| attribute | type      | description | required |
| --------- | --------- | ----------- | -------- |
| as        | `string`  | Unique variable name. | ✅ |
| model     | `string`  | AI provider and model name. [See AI providers](#ai-providers). | ✅ |
| tools     | `array`   | An array of tools the LLM can use . [See using tools](#using-tools). | |
| stream    | `boolean` | Whether to stream the response. *Defaults true* | |
| options   | `object`  | LLM generation options. Docs TODO. | |

The result of the generation will be stored in the workflow's state as a text type using the name given in the `as` attribute. The value can then be referenced using that name in subsequent expressions.

## Structured data

Object generation uses the same LLMs as text generation, but constrains and validates the output against a given schema, enabling the generation of structured data and objects.

```mdx
Scrape the following web page and create a list of conference speakers:

{url}

<GenObject
  as="speakers"
  model="anthropic:claude-3-5-sonnet-20240620"
  output="array"
  schema={
    $.z.object({
    name: $.z.string().describe('Full name of the speaker'),
    company: $.z.string().describe('Comany name'),
    twitter: $.z.string().describe('LinkedIn social profile').optional(),
    twitter: $.z.string().describe('Twitter social profile').optional(),
    })
  } />
```

The `<GenObject />` action works the same way as `<GenText />` in that it uses the immediately preceding context as input. In addition, it accepts the following attributes:

| attribute         | type      | description | required |
| ----------------- | --------- | ----------- | -------- |
| as                | `string`  | Unique variable name. | ✅ |
| model             | `string`  | AI provider and model name. [See AI providers](#ai-providers). | ✅ |
| output            | `string`  | One of `object`, `array`, `enum` or `no-schema`. *Defaults `object`* | |
| enum              | `array`   | Array of possible values to generate when output is `enum`. | ✅ * |
| schema            | `ZodType` | Zod schema that describes the shape of the object to generate. | ✅ * |
| schemaName        | `string`  | Optional name of the output for additional LLM guidance. | |
| schemaDescription | `string`  | Optional description of the output for additional LLM guidance. | |
| tools             | `array`   | An array of tools the LLM can use . [See using tools](#using-tools). | |
| options           | `object`  | LLM generation options. Docs TODO. | |

::: info ℹ️ Output types *
When the `output` type is `object` or `array` then the `schema` attribute is required. When the `output` type is `enum` then a list of possible values is required in the `enum` attribute.

When the `output` type is `no-schema`, the LLM is free to determine its own schema, and neither the `schema` nor `enum` attributes are required.
:::

::: info ℹ️ Zod schemas
The `schema` attribute accepts an expression that returns a [zod schema](https://zod.dev), using the `$.z` [action helper](/guide/workflow-structure#action-helpers). Ensuring the schema is property described helps guide the LLM to generate an accurate output.
:::

The result of the generation will be stored in the workflow's state as a JSON type using the name given in the `as` attribute. Because the value is structured data, subsequent expressions can access, traverse and iterate over the value.

```mdx
<Loop
  as="messages"
  until={$.index === speakers.filter(s => !!s.twitter).length}
  provide={{ speaker: speakers.filter(s => !!s.twitter)[$.index] }}>

  Write a tweet to the conference speaker thanking them for their
  presentation. Use a disturbing amount of emojis.

  Name: {speaker.name}
  Company: {speaker.company}
  Twitter: {speaker.twitter}

  <GenText as="tweet" model="anthropic:claude-3-5-sonnet-20240620" />
</Loop>
```

## AI providers

Under the hood, Agentflow's AI generation actions are powered by Vercel's [AI SDK](https://sdk.vercel.ai/docs), and so Agentflow is compatible with any AI providers supported by Vercel's SDK. Between Vercel and the open source community, all of the popular AI providers (such as OpenAI, Anthropic, Google and more) are fully supported, as well as tools such as Ollama for fully-local open source AI models. View the docs for full list of [supported AI providers](https://sdk.vercel.ai/providers/ai-sdk-providers).

The Agentflow project initialiser installs the OpenAI provider by default. Additional providers can be installed using your package manager.

::: code-group
```sh [npm]
npm install @ai-sdk/anthropic
```
```sh [yarn]
yarn add @ai-sdk/anthropic
```
```sh [bun]
bun add @ai-sdk/anthropic
```
:::

Then ensure all providers are configured in your project's `agentflow.config.js`. The following configuration requires your `.env` file to contain `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` environment variables.

```ts
import { defineConfig } from '@agentflow/core'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

export default defineConfig({
  providers: {
    openai,
    anthropic,
  }
})
```

If a customised provider setup is needed, you can create new instances of providers with your own settings. This is particularly useful for using OpenAI compatible providers in your workflows.

```ts
import { defineConfig } from '@agentflow/core'
import { createOpenAI } from '@ai-sdk/openai'

export default defineConfig({
  providers: {
    openai: createOpenAI({
      apiKey: process.env.COMPANY_OAI_KEY,
      compatibility: 'strict',
    }),
    together: createOpenAI({
      apiKey: process.env.TOGETHER_API_KEY,
      baseURL: 'https://api.together.xyz/v1',
      compatibility: 'compatible',
    }),
  }
})
```

To use a specific model with the `<GenText />` and `<GenObject />` actions, set the `model` attribute to a string with the format `providerId:modelId`. Always refer to the documentation of the provider for the available model IDs.

```mdx
Write the outline of a short survival novel set in a cyberpunk dystopian world.

<GenText
  as="outline"
  model="together:meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo" />
```

## Using tools

TODO
