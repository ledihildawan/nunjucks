import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NunjucksConfig } from '@nunjucks/core';

const viewsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'views');

// WHY: single source of truth for the demo's engine contract — main.ts and its smoke test
// import the same config so the documented globals/filters cannot drift apart.
const engineConfig: NunjucksConfig = {
  views: viewsDir,
  // WHY: explicit autoescape — the getting-started sample states its security
  // posture instead of silently relying on the engine default.
  autoescape: true,
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
};

export { engineConfig };
