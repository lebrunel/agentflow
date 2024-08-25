import { z } from 'zod'

// Base input schema
export const BaseInput = z.object({
  type: z.string(),
  message: z.optional(z.string()),
})

export type BaseInput = z.infer<typeof BaseInput>

// Text input schema
export const TextInput = BaseInput.extend({
  type: z.literal('text'),
  multiline: z.optional(z.boolean()),
})

export type TextInput = z.infer<typeof TextInput>

// Select input schema
export const SelectInput = BaseInput.extend({
  type: z.literal('select'),
  options: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ]))
})

export type SelectInput = z.infer<typeof SelectInput>

// File input schema
export const FileInput = BaseInput.extend({
  type: z.literal('file'),
  fileType: z.union([
    z.literal('text'),
    z.literal('image'),
  ])
})

export type FileInput = z.infer<typeof FileInput>

// Aulti input schema
export const ArrayInput = BaseInput.extend({
  type: z.literal('array'),
})

export type ArrayInput = z.infer<typeof ArrayInput>

// Any input schema
export const WorkflowInput = z.union([
  TextInput,
  SelectInput,
  FileInput,
  ArrayInput,
])

export type WorkflowInput = z.infer<typeof WorkflowInput>

// Workflow Inputs schema
export const WorkflowInputSchema = z.record(z.string(), WorkflowInput)
export type WorkflowInputSchema = z.infer<typeof WorkflowInputSchema>
