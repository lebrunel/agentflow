# Control flow

Agentflow is built on the idea of programming with natural language. Prompting and AI generations will only get you so far - to be a true programming language some form of control flow is needed. Agentflow supports looping and conditional branching through the `<Loop />` and `<Cond />` actions.

## Looping

Looping is a powerful, foundational programming concept that most modern, general-purpose programming languages provide through loop constructs or recursion. In Agentflow, the `<Loop />` action lets you repeat part of your workflow until a condition is met.

```mdx
<Loop
  as="history"
  until={2000 + $.index > new Date().getFullYear()}
  provide={{ year: 2000 + $.index }}>

  Write an interesting fact about the year: {year}

  <GenText as="fact" model="openai:gpt-4o" />
</Loop>
```

The `<Loop />` action wraps around an inner block of workflow content, which has its own [scope](/guide/workflow-structure#block-scoping) and is isolated from the parent scope. This introduces a new dynamic:

- Any attribute expressions on the `<Loop />` action itself are evaluated with the context of the scope that the action is in - that is the *parent* scope.
- Any expressions nested inside the `<Loop />` action are evaluated with the context of the inner, *child* scope.

### Attributes

| attribute | type      | description           | required |
| --------- | --------- | --------------------- | -------- |
| as        | `string`  | Unique variable name. | ✅       |
| until     | `boolean` | Expression returning a boolean to determine when to break the loop. | ✅ |
| provide   | `object`  | Optional expression returning an object of keys and values that are provided to the child scope. Evaluated once at the start of | |

Both the `until` and `provide` expressions are evaluated at the beginning of **every** iteration.

The result of the loop will be stored in the workflow's state as a JSON array type using the name given in the `as` attribute.

### Helper properties

In the loop example above, you may have noticed the use of `$.index`. This is a [action helper](/guide/workflow-structure#action-helpers). The `<Loop />` action helpers allow the actions own attribute expressions and flow expressions within the child scope to introspectively access the current state of the loop.

| property | type     | description           |
| -------- | -------- | --------------------- |
| `index`  | `number` | The zero-based index of the current iteration within the loop. |
| `self`   | `array`  | An array of objects representing the accumulated state of all iterations of the loop. |
| `last`   | `object` or `undefined` | The result of the previous iteration (undefined on the first iteration). Equivalent to `$.self[$.self.length - 1]`. |

## Conditional branching

Conditional branching is another fundamental programming concept where the execution of code follows different paths depending on a specified condition. In Agentflow, the `<Cond />` action lets define different blocks of workflow to be executed, depending on a condition.

```mdx
<Cond as="weekday" if={dayOfWeek >= 1 && dayOfWeek <= 5}>
  It's a weekday. Suggest a quick, healthy breakfast idea for a busy
  professional.

  <GenText as="meal" model="openai:gpt-4o" />
</Cond>
<Cond as="weekend" if={dayOfWeek < 1 || dayOfWeek > 5}>
  It's the weekend. Propose a leisurely brunch recipe to enjoy with family
  or friends.

  <GenText as="meal" model="openai:gpt-4o" />
</Cond>
```

::: info If/Else
For now, implementing an If/Else pattern requires multiple `<Cond />` actions with mutually exclusive `if` conditions. In future, if/else and switch/case patterns will be possible with the `<Cond />` action.
:::

### Attributes

| attribute | type      | description           | required |
| --------- | --------- | --------------------- | -------- |
| as        | `string`  | Unique variable name. | ✅       |
| if        | `boolean` | Expression returning a boolean to determine whether to execute the block. | ✅ |
| provide   | `object`  | Optional expression returning an object of keys and values that are provided to the child scope. Evaluated once at the start of | |

The `<Cond />` action provides no helpers.
