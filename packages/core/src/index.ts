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
  type ContextName,
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
  ExecutionState,
  ExecutionStatus,
  BaseInput,
  TextInput,
  SelectInput,
  FileInput,
  ArrayInput,
  WorkflowInput,
  WorkflowInputSchema,
  Runtime,
  type UserConfig,
  type ExecutionOptions,
  type ExecutionEvents,
  type ExecutionCursor,
  type Plugin,
  type Co
} from './runtime'

export {
  defineAction,
  type Action,
  type ActionOptions,
} from './action'

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
