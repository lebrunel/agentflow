---
description: Learn how to structure Agentflow workflows using Markdown, including phases, actions, and expressions for building AI-powered automation. Documentation and syntax guide.
---

# Workflow structure

A workflow is a plain text document, representing an overall process or goal. A workflow is formatted using Markdown (with a few syntactical extras), which inherently gives the workflow a structure, organised into three levels:

1. **Workflow**: The complete program defined by the user using natural language and Markdown.
2. **Phase**: A subsection of the workflow, representing a mini-program that can utilise context from previous phases.
3. **Action**: An individual step within a phase, representing a single request sent to the LLM for generating a response.

When a workflow is executed, it is processed from top to bottom, handling each phase in order, and executing each action within each phase in turn.

## Markdown

Workflows are written using Markdown - a lightweight markup syntax that adds some formatting and structure to the content of the workflow. The Agentflow compiler uses the same parser as [MDX](https://mdxjs.com/) and has a few extras to get used to.

- All standard Markdown syntax is fully supported.
- Horizontal rules (`---`) are used to break the workflow up into [phases](#phases).
- Flow elements (`<GenText as="foo" />`) are used to call [actions](#actions).
- Flow elements that wrap around an inner block of content have [scoping rules](#block-scoping).
- MDX-like JavaScript expressions (`Hello {name}`) are fully supported and are used to inject the result of previous actions into the current context.
- Frontmatter is fully supported and used to define [input data](/guide/input-data).

## Phases

A workflow consists of one or more phases, which are denoted by breaking the document up with horizontal rules (`---`).

Within a phase, all the content prior to an action (including the result of previous actions) becomes the context for that action. A new phase effectively creates a new clean context, and the results from actions in previous phases are not provided as part of the context unless explicitly injected using small JavaScript expressions.

::: code-group
```mdx [Single phase]
> Within a single phase, the result of each actions builds up the context
> that is provided to subsequent actions.

Write a poem about cats.

<GenText as="poem" model="openai:gpt-4o" />

Now translate it to German:

<GenText as="translation" model="openai:gpt-4o" />
```
```mdx [Multiple phases]
> Seperate phases have their own isolated context.

Write a poem about cats.

<GenText as="poem" model="openai:gpt-4o" />

---

> Output from previous phases can be injected into the context of this
> phase using a JavaScript expression.

Translate this poem to German: {poem}

<GenText as="translation" model="openai:gpt-4o" />
```
:::

Therefore, phases serve as a way for users to break their workflows up and control the context that is used with each action.

### Workflow description

If the first phase of a workflow contains no actions, the Agentflow compiler considers it not a phase at all, but in fact an informational block in which the workflow author can add any descriptive text or documentation to help users understand what the workflow does and how to use it.


## Actions

Each phase can contain any number of actions. Within the Markdown, an action looks like an HTML element or a React component - each action has a name and accepts a number of attributes that are used to pass properties to the action.

All actions result in an output that is assigned to the variable name specified with the `as` attribute. Subsequent expressions can reference these variables.

Agentflow ships with a handful of built-in actions:

- [AI generation actions](/guide/ai-generations) - `<GenText />` and `<GenObject />` are used to generate either text or structured data based on the provided context.
- [Control flow actions](/guide/control-flow) - `<Loop />` and `<Cond />` are used to implement control flow mechanisms within the workflow.

In addition to the built-in actions, users can create custom actions. Under the hood, an action is just a function that returns a result. It's possible to create custom actions that interface and interact with just about anything imaginable.

## Expressions

Expressions are small snippets of JavaScript embedded within a workflow, denoted by a pair of braces (`{ }`). Expressions provide a way to access input data and results from previous actions, and dynamically inject that data into subsequent workflow content and action attributes.

Expressions are evaluated at runtime, allowing for dynamic and context-aware workflows that can adapt based on input, generated content, and the current execution state.

Expressions can be used in the following places:

- **Text expressions** - Used within lines of text.
- **Flow expressions** - Root level blocks that can span multiple lines.
- **Attribute expressions** - Use in action attributes.

For example:

```mdx
This is a text expression: Hello {name}!

{
  // this is a flow expression
  instructions.join('\n').map(str => `- ${str}`)
}

<GenText as="foo" model={preferredModel} />
```

### Context in expressions

Expressions can access:

- A workflow's [input data](/guide/input-data) defined in its Frontmatter.
- Results from previous actions **in the same scope**.
- Helper functions and properties provided by the current (or parent) action.

### Action helpers

Actions can provide "helpers" that are accessible in its own attributes, and in the case of `<Loop />` and `<Cond />`, within its own scope. Action helpers can be accessed through special variables:

- The `$` variable provides access to the current action's helpers.
- A variable prefixed with `$` followed by the action name (e.g., `$foo` for an action with `as="foo"`) also provides access to that action's helpers.

This is particularly useful in nested scenarios:

```mdx
<Loop
  as="outer"
  until={$.index === items.length}
  provide{{ items }}>

  <Loop
    as="inner"
    until={$.index === items[$outer.index].subitems.length}
    provide={{
      item: items[$outer.index],
      subitem: items[$outer.index].subitems[$.index],
    }}>

    Item: {item.name}
    Subitem: {subitem.name}
  </Loop>
</Loop>
```

In this example, `$` refers to the outer loop's helpers when used in the outer loop's expressions, but refers to the inner loop's helpers when used in the inner loop's expressios. Therefore the inner loop can access both the inner and outer loop's helpers by using the `$outer` variable.

### Block scoping

Where actions wrap around a block of workflow (like `<Loop />` and `<Cond />`), the wrapped block has its own "scope". Each scope can be organised with sub-phases and actions. It's like embedding a workflow within a workflow.

Nested scopes are **isolated by default**. Whilst assigning actions to the same variable name in the same scope will cause a compile error, names can be reused within a new scope. Additionally, state from the parent scope must be explicitly provided using the `provide` attribute.

```mdx
Write a poem about cats.

<GenText as="poem" model="openai:gpt-4o" />

<Loop
  as="translations"
  until={$.index === langs.length}
  provide={{
    language: langs[$.index],
    original: poem,
  }}>

  Translate this poem to {language}:
  {original}

  <GenText as="poem" model="openai:gpt-4o" />
</Loop>
```
