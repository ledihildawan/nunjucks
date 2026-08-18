// WHY: star-composed barrel-of-barrels — factory/, traverse.ts, and types/ are each
// already curated barrels (see factory/index.ts), and re-listing their combined ~200
// names here would duplicate those lists and invite drift; the star is the composition.
export * from './factory/index.ts';
export * from './traverse.ts';
export * from './types/index.ts';
