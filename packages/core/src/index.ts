// Polyfill TextDecoderStream for Bun
import TextDecoderStream from 'polyfill-text-decoder-stream'
global.TextDecoderStream = TextDecoderStream

export {
  defineAction,
  type Action,
  type ActionOptions,
} from './action'

export * as actions from './actions'

export {
  compile,
  compileSync,
  createCompiler,
  createStringifier,
  createScopedView,
  stringify,
  stringifyContext,
  walkScopeTree,
  type ActionNode,
  type ExpressionNode,
  type StringifyOptions,
  type WorkflowScope,
  type WorkflowPhase,
  type WorkflowStep,
  type WorkflowWalker,
} from './ast'

export {
  fromContextValue,
  toContextValue,
  wrapContext,
  unwrapContext,
  type ContextKey,
  type ContextValue,
  type ContextValueMap,
} from './context'

export {
  defineConfig,
  Environment,
  type Plugin,
  type UserConfig,
} from './env'

export {
  cursorCompare,
  evalExpression,
  getExpressionDependencies,
  parseLocation,
  ExecutionController,
  ExecutionCursor,
  ExecutionState,
  ExecutionStatus,
  ExecutionWalker,
  type ActionResult,
  type AfterStepCallback,
  type CursorLocation,
  type ExecutionEvents,
  type ExecutionScope,
  type StepEvent,
  type StepResult,
} from './exec'

export * from './inputs'

export {
  defineTool,
  type Tool,
  type ToolOptions,
} from './tool'

export {
  Workflow,
  type InputResolver,
  type WorkflowMetadata,
  type WorkflowValidator,
} from './workflow'

export {
  models,
  type CostCalculator,
  type ModelSpec,
} from './ai'
