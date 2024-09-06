// Polyfill TextDecoderStream for Bun
import TextDecoderStream from 'polyfill-text-decoder-stream'
global.TextDecoderStream = TextDecoderStream

export {
  compile,
  compileSync,
  createProcessor,
  type CompileOptions,
  type WorkflowNode,
  type PhaseNode,
  type ActionNode,
  type ExpressionNode,
} from './compiler'

export {
  stringifyContext,
  type ContextKey,
  type ContextType,
  type ContextTypeMap,
  type ContextValue,
  type ContextValueMap,
  type ContextTextValue,
  type ContextImageValue,
} from './context'

export {
  defineConfig,
  executeWorkflow,
  evalExpression,
  evalExpressionSync,
  evalDependencies,
  ExecutionController,
  ExecutionStatus,
  ExecutionCursor,
  BaseInput,
  TextInput,
  SelectInput,
  FileInput,
  ArrayInput,
  WorkflowInput,
  WorkflowInputSchema,
  ExecutionNavigator,
  Runtime,
  ExecutionState,
  type UserConfig,
  type ActionEvent,
  type AfterActionCallback,
  type ExecutionOptions,
  type ExecutionEvents,
  type Cursor,
  type Plugin,
} from './runtime'

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
  Workflow,
  type WorkflowPhase,
  type WorkflowAction,
} from './workflow'

export {
  models,
  type CostCalculator,
  type ModelSpec,
} from './ai'
