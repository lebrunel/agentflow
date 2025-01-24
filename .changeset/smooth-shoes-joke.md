---
"@agentflow/core": minor
---

Supports JSX fragments in workflows.
Estree is transpiled to handle both `<></>` fragments and `include()` calls consistently.
Refactor of compiling logic to use new universal visitor function that traverses both MDX and JSX nodes.
