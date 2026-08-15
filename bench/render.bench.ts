// WHY: regression radar — run with `bun run bench`; absolute numbers are machine-dependent,
// the value is in catching order-of-magnitude drift between commits. Plain timing loops
// (this Bun's bun:test has no bench API); async time-based iteration is exempt from the
// declarative-loop policy.
import { nunjucks } from '@nunjucks/core';

interface BenchCase {
  name: string;
  render: () => Promise<unknown>;
  iterations: number;
}

const engine = nunjucks({});

const simpleTemplate = 'Hello {{ name }}!';
const loopTemplate =
  '{% for item in items %}{{ loop.index }}: {{ item.title |> upper }} ({{ loop.revindex }} left)\n{% endfor %}';
const items = Array.from({ length: 200 }, (_, index) => ({ title: `item-${index}` }));

const drainStream = async (): Promise<void> => {
  const stream = await engine.renderToStream(loopTemplate, { items });
  if (!stream.ok) {
    throw new Error('expected stream');
  }
  for await (const _chunk of stream.value) {
    // drain
  }
};

const benchCases: BenchCase[] = [
  {
    name: 'render: simple interpolation',
    render: () => engine.render(simpleTemplate, { name: 'World' }),
    iterations: 5000,
  },
  {
    name: 'render: 200-item loop with filter',
    render: () => engine.render(loopTemplate, { items }),
    iterations: 500,
  },
  {
    name: 'renderToStream: 200-item loop',
    render: drainStream,
    iterations: 500,
  },
];

const runCase = async (benchCase: BenchCase): Promise<void> => {
  for (let i = 0; i < Math.min(50, benchCase.iterations); i += 1) {
    await benchCase.render();
  }
  const startedAt = performance.now();
  for (let i = 0; i < benchCase.iterations; i += 1) {
    await benchCase.render();
  }
  const elapsedMs = performance.now() - startedAt;
  const opsPerSecond = Math.round(benchCase.iterations / (elapsedMs / 1000));
  // biome-ignore lint/suspicious/noConsole: bench is a CLI tool (shell perimeter) — reporting IS the product.
  console.log(`${benchCase.name.padEnd(36)} ${String(opsPerSecond).padStart(8)} ops/s  (${(elapsedMs / benchCase.iterations).toFixed(3)} ms/op)`);
};

const main = async (): Promise<void> => {
  // biome-ignore lint/suspicious/noConsole: bench is a CLI tool (shell perimeter) — reporting IS the product.
  console.log(`nunjucks bench — ${process.platform}, bun ${Bun.version}`);
  for (const benchCase of benchCases) {
    await runCase(benchCase);
  }
};

await main();
