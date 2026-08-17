import { nunjucks } from '@nunjucks/core';
import { isErr, isOk } from '@nunjucks/lib';
import { engineConfig } from './engine-config.ts';

const njk = nunjucks(engineConfig);

// WHY: independent renders are scheduled concurrently — engine.render is an async boundary,
// so sequential awaiting here would add latencies for no data dependency.
const [helloResult, versionResult, greetResult, kwargsResult, destructResult, pipeResult] =
  await Promise.all([
    njk.render('hello.njk', { name: 'World' }),
    njk.render('{{ appName }} v{{ version }}'),
    njk.render('greet.njk'),
    njk.render('kwargs.njk', { date: new Date() }),
    njk.render('destruct.njk'),
    njk.render('pipe-demo.njk', { name: 'Nunjucks' }),
  ]);

const outcomes = [
  helloResult,
  versionResult,
  greetResult,
  kwargsResult,
  destructResult,
  pipeResult,
];
const outcomeLines = outcomes.map((result) =>
  isOk(result) ? result.value : `render failed: ${result.error.message}`
);
console.log(outcomeLines.join('\n'));

const failedCount = outcomes.filter(isErr).length;
if (failedCount > 0) {
  process.exitCode = 1;
}
