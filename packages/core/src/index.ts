// Polyfill TextDecoderStream for Bun
import TextDecoderStream from 'polyfill-text-decoder-stream'
global.TextDecoderStream = TextDecoderStream

// Compiler exports
export { compileWorkflow } from './compiler/compiler'
export { Action } from './compiler/action'
export { Phase } from './compiler/phase'
export { Workflow } from './compiler/workflow'
export type {
  WorkflowInputs,
  InputSchema,
  TextInputSchema,
  SelectInputSchema,
  FileInputSchema,
  ArrayInputSchema,
} from './compiler/workflow'

// Runtime exports
export { defineAction } from './runtime/action'
export { defineConfig } from './runtime/config'
export { executeWorkflow, ExecutionController } from './runtime/controller'
export { Runtime } from './runtime/runtime'
export { ExecutionStatus } from './runtime/state'
export type { ActionHandler, ActionOptions, ActionResult } from './runtime/action'
export type { ContextValue, ContextValueMap } from './runtime/context'
export type { ExecutionOpts, ExecutionEvents, AfterActionCallback } from './runtime/controller'
export type { UserConfig } from './runtime/config'
export type { Plugin } from './runtime/runtime'
export type { ExecutionCursor } from './runtime/state'

// Other
export * as util from './util'