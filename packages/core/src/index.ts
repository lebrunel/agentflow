// Polyfill TextDecoderStream for Bun
import TextDecoderStream from 'polyfill-text-decoder-stream'
global.TextDecoderStream = TextDecoderStream

export {
  compile,
  compileSync,
  createCompiler,
  createStringifier,
  createScopedView,
  stringify,
  stringifyContext,
  walkScopeTree,
  type CompileOptions,
  type ActionNode,
  type ExpressionNode,
  type StringifyOptions,
  type WorkflowScope,
  type WorkflowPhase,
  type WorkflowStep,
  type WorkflowWalker,
} from './ast'

//export {
//  compile,
//  compileSync,
//  createProcessor,
//  type CompileOptions,
//  type WorkflowNode,
//  type PhaseNode,
//  type ActionNode,
//  type ExpressionNode,
//} from './compiler'

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

//export {
//  //defineConfig,
//  executeWorkflow,
//  evalExpression,
//  evalDependencies,
//  ExecutionController,
//  ExecutionStatus,
//  ExecutionCursor,
//  BaseInput,
//  TextInput,
//  SelectInput,
//  FileInput,
//  ArrayInput,
//  WorkflowInput,
//  WorkflowInputSchema,
//  ExecutionNavigator,
//  Runtime,
//  ExecutionState,
//  //type UserConfig,
//  type ActionEvent,
//  type AfterActionCallback,
//  type ExecutionOptions,
//  type ExecutionEvents,
//  type Cursor,
//  //type Plugin,
//} from './runtime'

export {
  defineAction,
  type Action,
  type ActionOptions,
} from './action'

export * as actions from './actions'

export {
  defineTool,
  type Tool,
  type ToolOptions,
} from './tool'

export {
  Workflow
} from './workflow'

export {
  models,
  type CostCalculator,
  type ModelSpec,
} from './ai'
