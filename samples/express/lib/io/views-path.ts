import type { NunjucksConfig } from '@nunjucks/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// WHY: single shell-level owner of the views directory resolution. Every route and demo module
// imports VIEWS from here instead of re-computing __dirname independently (was duplicated 6×).
const currentDir = path.dirname(fileURLToPath(import.meta.url));
/** Resolves the absolute path of the views directory. */
const VIEWS = path.resolve(currentDir, '..', '..', 'views');

// WHY: named render-config constants (Rule-of-Three) — these exact shapes were repeated inline
// across routes; consumers with genuinely distinct configs keep them inline.
const strictErrorRouteConfig: NunjucksConfig = { dev: true, undefined: 'strict', views: VIEWS };
const devErrorRouteConfig: NunjucksConfig = { dev: true, views: VIEWS };
const demoRouteConfig: NunjucksConfig = { views: VIEWS };
const standardRouteConfig: NunjucksConfig = { dev: true, autoescape: true, views: VIEWS };

export { VIEWS, demoRouteConfig, devErrorRouteConfig, standardRouteConfig, strictErrorRouteConfig };
