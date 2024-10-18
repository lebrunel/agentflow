# Input data

Workflows usually involve processing some input data to generate an output. Agentflow provides two mechanisms to input data to a workflow's initial state.

- [Static data](#static-data) - data that is defined and hard-coded into in the workflow itself.
- [User input](#user-input) - data that is captured at runtime from the user.

## Static data

Static data can be defined in the workflow using the `data` field in the frontmatter metadata.

```mdx
---
data:
  quote: "Be yourself; everyone else is already taken."
  langs:
    - Spanish
    - Portugese
    - French
    - German
---

<Loop
  as="translations"
  until={$.index === langs.length}
  provide={{ langs, quote }}>

  Translate "{ quote }" into { langs[$.index] }

  <GenText as="translated" model="openai:gpt-4o" />
</Loop>
```

The frontmatter `data` field can be used to store any arbitrary keys and values. Values can be any type from simple primitives to deeply nested complex objects, and are accessed in expressions using the corresponding top-level key.

## User input

In the example in the section above, the `quote` data is hardcoded into the workflow. Now, every time you run the workflow, it'll generate the same translations for the same input quote. The workflow can be generalised and made more reusable by capturing the quote as an input at runtime.

User inputs can be defined using the `input` field in the frontmatter metadata.

```mdx
---
data:
  langs:
    - Spanish
    - Portugese
    - French
    - German
input:
  quote:
    type: text
    message: "Enter a quote to translate"
---

<Loop
  as="translations"
  until={$.index === langs.length}
  provide={{ langs, quote }}>

  Translate "{ quote }" into { langs[$.index] }

  <GenText as="translated" model="openai:gpt-4o" />
</Loop>
```

This example is almost the same as the previous one, but now when you execute the workflow you will be prompted to input a quote to be translated.

## Input types

The frontmatter `input` field must define a series of key-values, where each key is the name of the input and each value is a valid input type. Out of the box, Agentflow supports the following input types:

### Text input

Prompts the user to enter a text input.

| field     | type      | description                             | required |
| --------- | --------- | --------------------------------------- | -------- |
| type      | `string`  | Must be `"text"`                        | ✅       |
| message   | `string`  | The prompt to be displayed to the user. |          |
| multiline | `boolean` | When true opens the default text editor for multiline input. *Defaults false* | |

### Select input

Prompts the user to select from a list of options.

| field   | type     | description                             | required |
| ------- | -------- | --------------------------------------- | -------- |
| type    | `string` | Must be `"select"`                      | ✅       |
| options | `array`  | The list of options from which to choose. Can either be an array of strings or array of objects with `name` (presentational) and `value` properties. | ✅ |

### File input

Prompts the user to enter a local file path or URL. The file will be fetched and loaded, and it's contents as passed to the workflow. Supports `text` or `image` files.

| field    | type     | description                             | required |
| -------- | -------- | --------------------------------------- | -------- |
| type     | `string` | Must be `"file"`                        | ✅       |
| fileType | `string` | The type of file to load, either `text` or `image`. | ✅ |

### Array input

Prompts the user to continuously enter text inputs which are passed to the workflow as an array.

| field    | type     | description                             | required |
| -------- | -------- | --------------------------------------- | -------- |
| type     | `string` | Must be `"array"`                        | ✅       |
| multiline | `boolean` | When true opens the default text editor for multiline input. Each line will be a seperate element of the array. *Defaults false* | |

## Variable names

In Agentflow all variable names - whether from inputs or variables created from actions - must be unique. Duplicate names will result in a compile error. The exception to this is nested scopes inside `<Loop />` and `<Cond />` actions, where Agentflow's [block scoping rules](/guide/workflow-structure#block-scoping) apply.
