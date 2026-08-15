import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nunjucks } from '@nunjucks/core';
import { isOk } from '@nunjucks/lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS = path.join(__dirname, 'views');

const njk = nunjucks({
  views: VIEWS,
  globals: {
    appName: 'Nunjucks App',
    greet: ({ name, greeting }: { name: string; greeting: string }) => `${greeting}, ${name}!`,
  },
  filters: {
    formatDate: (
      date: Date,
      { format = 'long', locale = 'en-US' }: { format?: string; locale?: string }
    ) =>
      new Intl.DateTimeFormat(locale, { dateStyle: format === 'long' ? 'long' : 'short' }).format(
        date
      ),
  },
});

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
for (const result of outcomes) {
  console.log(isOk(result) ? result.value : result.error);
}
