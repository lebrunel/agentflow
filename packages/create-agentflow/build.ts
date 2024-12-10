// Node bundle
Bun.build({
  entrypoints: ['./src/index.ts', './src/create-agentflow.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  packages: 'external',
  sourcemap: 'external',
  minify: false,
})
