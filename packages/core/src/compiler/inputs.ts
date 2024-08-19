import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

import { dd } from '~/util'

// Base input schema
export const BaseInputSchema = Type.Object({
  type: Type.String(),
  message: Type.Optional(Type.String()),
})

export type BaseInput = Static<typeof BaseInputSchema>

// Text input schema
export const TextInputSchema = Type.Intersect([
  BaseInputSchema,
  Type.Object({
    type: Type.Literal('text'),
    multiline: Type.Optional(Type.Boolean()),
  })
])

export type TextInput = Static<typeof TextInputSchema>

// Select input schema
export const SelectInputSchema = Type.Intersect([
  BaseInputSchema,
  Type.Object({
    type: Type.Literal('select'),
    options: Type.Array(Type.Union([
      Type.String(),
      Type.Object({
        name: Type.String(),
        value: Type.String(),
      })
    ]))
  })
])

export type SelectInput = Static<typeof SelectInputSchema>

// File input schema
export const FileInputSchema = Type.Intersect([
  BaseInputSchema,
  Type.Object({
    type: Type.Literal('file'),
    fileType: Type.Union([
      Type.Literal('text'),
      Type.Literal('image'),
    ])
  })
])

export type FileInput = Static<typeof FileInputSchema>

// Aulti input schema
export const ArrayInputSchema = Type.Intersect([
  BaseInputSchema,
  Type.Object({
    type: Type.Literal('array'),
  })
])

export type ArrayInput = Static<typeof ArrayInputSchema>

// Any input schema
export const InputSchema = Type.Union([
  TextInputSchema,
  SelectInputSchema,
  FileInputSchema,
  ArrayInputSchema,
])

export type Input = Static<typeof InputSchema>

// Workflow Inputs schema
export const WorkflowInputsSchema = Type.Record(Type.String(), InputSchema)
export type WorkflowInputs = Static<typeof WorkflowInputsSchema>

// Validations

const compiledSchema = TypeCompiler.Compile(WorkflowInputsSchema)

export function validateWorkflowInputs(inputs: any): asserts inputs is WorkflowInputs {
  if (!compiledSchema.Check(inputs)) {
    const errors: string[] = []
    for (const error of compiledSchema.Errors(inputs)) {
      errors.push(`Invalid input schema at ${error.path}. ${error.message}.`)
    }
    throw new Error(dd`
    Invalid inputs for workflow:
    - ${errors.join('\n- ')}
    `)
  }
}
