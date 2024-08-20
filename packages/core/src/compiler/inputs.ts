import { z } from 'zod'

// Base input schema
export const BaseInputSchema = z.object({
  type: z.string(),
  message: z.optional(z.string()),
})

export type BaseInput = z.infer<typeof BaseInputSchema>

// Text input schema
export const TextInputSchema = BaseInputSchema.extend({
  type: z.literal('text'),
  multiline: z.optional(z.boolean()),
})

export type TextInput = z.infer<typeof TextInputSchema>

// Select input schema
export const SelectInputSchema = BaseInputSchema.extend({
  type: z.literal('select'),
  options: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ]))
})

export type SelectInput = z.infer<typeof SelectInputSchema>

// File input schema
export const FileInputSchema = BaseInputSchema.extend({
  type: z.literal('file'),
  fileType: z.union([
    z.literal('text'),
    z.literal('image'),
  ])
})

export type FileInput = z.infer<typeof FileInputSchema>

// Aulti input schema
export const ArrayInputSchema = BaseInputSchema.extend({
  type: z.literal('array'),
})

export type ArrayInput = z.infer<typeof ArrayInputSchema>

// Any input schema
export const InputSchema = z.union([
  TextInputSchema,
  SelectInputSchema,
  FileInputSchema,
  ArrayInputSchema,
])

export type Input = z.infer<typeof InputSchema>

// Workflow Inputs schema
export const WorkflowInputsSchema = z.record(z.string(), InputSchema)
export type WorkflowInputs = z.infer<typeof WorkflowInputsSchema>

// Validations

export function validateWorkflowInputs(inputs: any): asserts inputs is WorkflowInputs {
  WorkflowInputsSchema.parse(inputs)
}
