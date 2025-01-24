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
  createCompiler,
  createStringifier,
  createScopedView,
  reportFail,
  stringify,
  stringifyContext,
  walkScopeTree,
  visitor,
  type ActionNode,
  type CompileFailCallback,
  type ExpressionNode,
  type EsVisitor,
  type MdVisitor,
  type StringifyOptions,
  type VisitorContext,
  type VisitorFactory,
  type WorkflowScope,
  type WorkflowPhase,
  type WorkflowStep,
  type WorkflowValidator,
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
  createDynamicEvaluator,
  createSealedEvaluator,
  cursorCompare,
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

export {
  defineTool,
  type Tool,
  type ToolOptions,
} from './tool'

export {
  Workflow,
  type WorkflowMetadata,
} from './workflow'

//export {
//  models,
//  type CostCalculator,
//  type ModelSpec,
//} from './ai'
