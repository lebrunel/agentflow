await Promise.all([
  Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    packages: 'external',
    target: 'node',
  }),

  Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    minify: true,
    naming: "[dir]/[name].min.[ext]",
    packages: 'external',
    target: 'browser',
  })
])
