// Node bundle
Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  packages: 'external',
  sourcemap: 'external',
  minify: false,
})
