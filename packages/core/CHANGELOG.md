# @agentflow/core

## 0.2.8

### Patch Changes

- Bymp

## 0.2.7

### Patch Changes

- Force bump

## 0.2.6

### Patch Changes

- Force bump

## 0.2.5

### Patch Changes

- Bump

## 0.2.4

### Patch Changes

- Force

## 0.2.3

### Patch Changes

- Force bump

## 0.2.2

### Patch Changes

- Force bump

## 0.2.1

### Patch Changes

- Force patch

## 0.2.0

### Minor Changes

- f2731ec: Renamed frontmatter.inputs as frontmatter.input.
- c430d36: Improvements to AST model, compile logic and action design. Built-in control-flow actions have been extracted into their own action functions.
- 39aaeb2: Refactor state manager so each scope is always an array of contexts.
  Loops now evaluate props on each iteration.
  Rationalise action helper naming to avoid naming collisions on nested actions.
- 940ac0b: Compiler supports parsing and validation of inital context from frontmatter data.
- 5fb5f01: Allow arbitary helpers to be defined per action to use in expressions. (replaces built-in globals)
- c1b18e7: Renamed IfAction as CondAction.
- 4d66981: Renamed GenerateText and GenerateObject actions as GenText and GenObject.

### Patch Changes

- bf5dcaf: - Simplified config API. Single shared environment for compilation and execution.
  - Make Environment instance immutable, apart from via plugins.
