declare module 'eval-estree-expression' {
  import { Node } from 'estree';
  import { GenerateOptions } from 'escodegen';

  interface EvalEstreeOptions {
    booleanLogicalOperators?: boolean;
    functions?: boolean;
    generate?: (ast: any, options?: GenerateOptions) => string;
    regexOperator?: boolean;
    strict?: boolean;
    withMembers?: boolean;
  }

  export const evaluate: {
    (tree: Node, context?: Record<string, any>, options?: EvalEstreeOptions): Promise<any>;
    sync(tree: Node, context?: Record<string, any>, options?: EvalEstreeOptions): any;
  }

  export const variables: (tree: Node, options?: EvalEstreeOptions) => string[];
}
