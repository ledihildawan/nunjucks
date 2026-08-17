const result = await Bun.build({
  entrypoints: ['./packages/@nunjucks/core/src/index.ts'],
  outdir: './dist',
  format: 'esm',
  splitting: false,
  minify: false,
  sourcemap: 'linked',
  target: 'bun',
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log('Build complete!');
