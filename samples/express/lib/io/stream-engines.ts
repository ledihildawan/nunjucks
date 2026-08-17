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

/** Streaming engine — strict undefined + error recovery for the HTML dashboard routes. */
const streamNjk = nunjucks({
  ...baseStreamConfig,
  undefined: 'strict',
  streaming: { errorRecovery: true },
});

/** Blocking engine — default-undefined buffered renders for the benchmark twin route. */
const blockingNjk = nunjucks({
  ...baseStreamConfig,
  undefined: 'default',
});

/** JSON streaming engine — recoverable sentinels are fatal so output stays parseable. */
const apiNjk = nunjucks({
  ...baseStreamConfig,
  undefined: 'strict',
  streaming: { errorRecovery: true, contentType: 'json' },
});

export { apiNjk, blockingNjk, streamNjk };
