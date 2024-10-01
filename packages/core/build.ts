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

// Browser bundle
Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'browser',
  packages: 'external',
  sourcemap: 'external',
  naming: "[dir]/[name].min.[ext]",
  minify: true,
})
