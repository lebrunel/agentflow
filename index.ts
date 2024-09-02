import { selectAll } from "unist-util-select";
import { createProcessor } from "./packages/core/src/";
import { parse } from "acorn";
import { variables } from "eval-estree-expression";

console.log("test scratchpad");

const src = `
Hello world

<Loop as="foo">
  One

  <Generate as="one" />

  ---

  Two

  <Generate as="two" />
</Loop>
`;

const proc = createProcessor();
const wf = proc.processSync(src);
console.dir(wf, { depth: 5 });

//const estree = parse(`foo.bar[1].baz`, { ecmaVersion: "latest" });
//const vars = variables(estree.body[0].expression, { withMembers: true });
//
//console.log(vars);
