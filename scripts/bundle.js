#!/usr/bin/env node

const TEST_ENV = process.env.NODE_ENV === 'test';

const destDir = TEST_ENV ? 'tests/browser' : 'browser';

const configs = [
  { min: false, slim: false },
  { min: false, slim: true },
  { min: true, slim: false },
  { min: true, slim: true },
];

async function buildBundle(opts) {
  const { min, slim } = opts;
  let ext = min ? '.min.js' : '.js';
  if (slim) ext = '-slim' + ext;
  const filename = `nunjucks${ext}`;
  const type = slim ? '(slim, only works with precompiled templates)' : '';

  console.log(`Building ${filename} ${type}...`);

  const defines = {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env.BUILD_TYPE': JSON.stringify(slim ? 'SLIM' : 'STD'),
  };

  const externals = [];
  if (slim) {
    externals.push('nunjucks/src/nodes');
    externals.push('nunjucks/src/lexer');
    externals.push('nunjucks/src/parser');
    externals.push('nunjucks/src/precompile');
    externals.push('nunjucks/src/transformer');
    externals.push('nunjucks/src/compiler');
  }

  try {
    const result = await Bun.build({
      entrypoints: ['nunjucks/index.js'],
      outdir: destDir,
      naming: filename,
      target: 'browser',
      format: 'iife',
      minify: min,
      sourcemap: 'linked',
      define: defines,
      external: externals,
    });

    if (!result.success) {
      console.error('Build failed:');
      for (const log of result.logs) {
        console.error(log);
      }
      process.exit(1);
    }

    console.log(`Built ${filename}`);
  } catch (err) {
    console.error('Build error:', err);
    process.exit(1);
  }
}

async function main() {
  for (const config of configs) {
    await buildBundle(config);
  }
  console.log('Build complete!');
}

main();
