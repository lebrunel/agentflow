---
description: Agentflow is a low-code framework for building AI workflows using natural language and Markdown. Create and execute AI agents without complex programming.
---

# What is Agentflow?

Agentflow is a low-code framework for creating and executing AI-powered workflows using natural language and Markdown. It makes the process of creating AI agents and automations as simple as expressing yourself in your own native language, all without sacrificing flexibility or power.

## Natural language programming

![@karpathy tweet](/images/karpathy-tweet.webp)

Agentflow embodies the idea encapsulated in [@karpathy's tweet](https://x.com/karpathy/status/1617979122625712128). Workflows are written using natural language and Markdown - a simple and lightweight markup syntax designed for easy readability and writability. The result is a toolset that is as easy to play and have fun with, as it is to create truly powerful, complex AI workflows.

For example, a simple workflow might look like this:

```mdx
Summarize the following article in three bullet points:
{article}

<GenText as="summary" model="openai:gpt-4" />
```

You don't need to be a professional programmer to use Agentflow, but it does encourage computational thinking and problem-solving, and you'll need to be comfortable with the command line to use our CLI. But once you're familiar with the tools, you'll discover that just by crafting instructions and prompts in your own native language, a world of incredible possibilities opens, limited only by your imagination.

## Powerful AI generation

At its heart, Agentflow is a tool to leverage advanced AI models to generate text and structured data for the actions in your workflows. Built on the robust foundations of [Vercel's AI SDK](https://sdk.vercel.ai/docs/introduction), Agentflow works seamlessly with all popular AI providers. It also supports local open-source AI models through tools like Ollama, giving you the freedom to choose your preferred AI solutions.

![AI providers](/images/agentflow-providers.webp)

Tool use (sometimes called "function calling") extends the capabilities of AI models, giving your workflows superpowers beyond text generation. Tools allow your workflows to integrate with web services, your local file system, databases and more. Agentflow supports any tools that are compatible with Vercel's AI SDK (such as [Agentic's tool library](https://agentic.so/intro)), and custom tools are simple to create with a little bit of JavaScript.

## Dev experience

Whether you're an experienced developer or just getting started with AI agents, Agentflow's tooling aims to provide an efficient and integrated developer experience through it's command-line interface (CLI). The CLI handles everything from project initialisation and workflow authoring through to execution management, streamlining the entire development process.

Agentflow is built with TypeScript and leverages the familiar JavaScript ecosystem (Node, NPM, Bun, Yarn, etc). This approach allows developers to leverage existing knowledge and tooling, reducing the learning curve and enabling quick integration into existing projects.

## Open source software

<div style="display: flex; gap: 0.5rem;">
  <img alt="NPM License" src="https://img.shields.io/npm/l/%40agentflow%2Fcore?style=flat-square">
  <img alt="NPM Version" src="https://img.shields.io/npm/v/%40agentflow%2Fcore?style=flat-square">
</div>


As free, open-source software, Agentflow runs on your own hardware and can be configured and extended to suit your specific needs. You have full control over your workflows and data, avoiding the limitations and costs imposed by SaaS platforms. Bring your own AI provider API keys, and pay for only the tokens your use.

Agentflow encourages community contributions and customisations, and will evolve and adapt to the community's requirements.

Check out [Agentflow on GitHub](https://github.com/lebrunel/agentflow).
