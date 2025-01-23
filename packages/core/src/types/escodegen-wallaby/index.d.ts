declare module 'escodegen-wallaby' {
  import { FormatOptions } from 'escodegen'

  // Import and re-export types from escodegen
  export * from 'escodegen'

  export const FORMAT_MINIFY: FormatOptions
  export const FORMAT_DEFAULTS: FormatOptions
}
