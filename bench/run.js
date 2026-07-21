// Nunjucks stage-by-stage benchmark suite.
// Run: bun run bench/run.js
//
// Measures each pipeline stage independently so optimizations can be
// attributed to the right layer:
//   parse    = source string -> AST
//   compile  = parse + transform + codegen -> JS source string
//   render   = full end-to-end (parse + transform + compile + execute)

import { readFileSync } from 'node:fs';
import { parse } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { createCompiler } from '@nunjucks/compiler';
import { render } from '../src/core/render.js';
import { mergeConfig } from '../src/config/global.js';

const TEMPLATES_DIR = new URL('./templates/', import.meta.url);

const readTemplate = (name) =>
  readFileSync(new URL(name, TEMPLATES_DIR), 'utf-8');

const TEMPLATES = {
  simple: readTemplate('simple.njk'),
  filters: readTemplate('filters.njk'),
  complex: readTemplate('case.html'),
};

const CONTEXT = {
  name: 'World',
  title: 'product catalog',
  description: 'A curated list of products for the benchmark suite that exercises a reasonable number of filters and loops.',
  header: 'Items',
  items: Array.from({ length: 50 }, (_, i) => ({
    current: i === 0,
    name: `Item ${i}`,
    url: `http://example.com/${i}`,
    price: (i * 7.31) + 0.99,
    tags: ['tag-a', 'tag-b', i % 2 === 0 ? 'even' : 'odd'],
  })),
};

// ---- measurement helpers -------------------------------------------------

const measure = async (fn, iters) => {
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) await fn();
  return performance.now() - t0;
};

const bench = async (name, fn, opts = {}) => {
  const { warmupMs = 150, rounds = 3, targetMs = 300 } = opts;

  // warmup: run for a time budget (not fixed iterations) so slow templates
  // don't spend forever warming up.
  const warmupStart = performance.now();
  while (performance.now() - warmupStart < warmupMs) await fn();

  // calibrate iterations to hit ~targetMs per round
  let iters = 1;
  let t = await measure(fn, iters);
  while (t < targetMs && iters < 100_000) {
    iters *= 2;
    t = await measure(fn, iters);
  }

  const times = [];
  for (let r = 0; r < rounds; r++) times.push(await measure(fn, iters));
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];

  const avgUs = (median / iters) * 1000;
  const opsPerSec = (iters / median) * 1000;

  return {
    name,
    iters,
    avgUs: avgUs,
    opsPerSec: opsPerSec,
    minMs: times[0],
    maxMs: times[times.length - 1],
  };
};

// ---- formatting ----------------------------------------------------------

const fmt = (n, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtOps = (n) => {
  if (n >= 1_000_000) return fmt(n / 1_000_000) + 'M';
  if (n >= 1_000) return fmt(n / 1_000) + 'k';
  return fmt(n, 0);
};

const printRow = (stage, result) => {
  const avg = fmt(result.avgUs, 2).padStart(10) + ' us/op';
  const ops = (fmtOps(result.opsPerSec) + '/s').padStart(12);
  const iters = (fmt(result.iters, 0) + 'x').padStart(12);
  console.log(`  ${stage.padEnd(10)} ${avg}   ${ops}   ${iters}`);
};

const printHeader = (label, size) => {
  console.log('');
  console.log(`  ${label}  (${size} bytes)`);
  console.log(`  ${'─'.repeat(54)}`);
};

// ---- suite ---------------------------------------------------------------

const runStage = async (stage, fn) => {
  const result = await bench(stage, fn);
  printRow(stage, result);
  return result;
};

const results = {};

for (const [key, src] of Object.entries(TEMPLATES)) {
  const renderContext = { ...CONTEXT };
  const renderConfig = mergeConfig({ autoescape: true, devWarningSandbox: false, sandbox: false });

  printHeader(`template: ${key}`, src.length);

  results[key] = {
    parse: await runStage('parse', () => parse(src)),

    compile: await runStage('compile', () => {
      const c = createCompiler(key, undefined, src);
      const ast = parse(src);
      const transformed = transform(ast);
      c.compile(transformed);
      c.getCode();
    }),

    render: await runStage('render', async () => {
      await render(src, renderContext, renderConfig);
    }),
  };
}

// ---- summary -------------------------------------------------------------

console.log('');
console.log('  Notes:');
console.log('  - parse    = lexer + parser (source -> AST)');
console.log('  - compile  = parse + transform + codegen (AST -> JS source)');
console.log('  - render   = full end-to-end pipeline (parse+compile+execute)');
console.log('');
console.log(`  Median of 3 rounds after time-bounded warmup. Bun ${Bun.version} on ${process.platform}-${process.arch}.`);
