import { nunjucks } from '@nunjucks/core';
import { VIEWS } from './views-path.ts';
import { slow, formatPrice } from '../domain/dashboard-data.ts';

// WHY: one factory per distinct config profile. /stream + /stream-api share strict-undefined + recovery;
// /stream-normal is a non-strict blocking benchmark; /stream-api adds the JSON content type (fatal sentinels).
// Configuring once at module load avoids rebuilding the engine per request.
const baseStreamConfig = {
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

export { streamNjk, blockingNjk, apiNjk };
