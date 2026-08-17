import { nunjucks } from '@nunjucks/core';
import { formatPrice } from '../domain/dashboard-data.ts';
import { slow } from './slow-filter.ts';
import { VIEWS } from './views-path.ts';

// WHY: one factory per distinct config profile. /stream + /stream-api share strict-undefined + recovery;
// /stream-normal is a non-strict blocking benchmark; /stream-api adds the JSON content type (fatal sentinels).
// Configuring once at module load avoids rebuilding the engine per request.
const baseStreamConfig = {
  // WHY: explicit even though the engine default is true — security samples should not rely on defaults.
  autoescape: true,
  dev: true,
  views: VIEWS,
  filters: { slow, formatPrice },
  limits: { executionTimeout: 30000 },
};

const streamNjk = nunjucks({
  ...baseStreamConfig,
  undefined: 'strict',
  streaming: { errorRecovery: true },
});

const blockingNjk = nunjucks({
  ...baseStreamConfig,
  undefined: 'default',
});

const apiNjk = nunjucks({
  ...baseStreamConfig,
  undefined: 'strict',
  streaming: { errorRecovery: true, contentType: 'json' },
});

export { apiNjk, blockingNjk, streamNjk };
