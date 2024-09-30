await Bun.build({
  entrypoints: ['./src/node.ts'],
  outdir: './dist',
  packages: 'external',
  target: 'node',
})
