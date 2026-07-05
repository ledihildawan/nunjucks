#!/usr/bin/env node

const destDir = 'browser';

async function buildBundle() {
  const filename = 'nunjucks.js';

  console.log(`Building ${filename}...`);

  const defines = {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  };

  try {
    const result = await Bun.build({
      entrypoints: ['nunjucks/index.js'],
      outdir: destDir,
      naming: filename,
      target: 'browser',
      format: 'iife',
      minify: false,
      sourcemap: 'linked',
      define: defines,
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

  console.log('Build complete!');
}

buildBundle();
