import type { RenderConfig } from '../render/render-types.ts';

// WHY: FNV-1a over the source — cache-key IDENTITY, not security. A full crypto hash
// would dominate the cost of small-template lookups; collision risk (2^32 birthday at
// ~65k distinct sources) merely shares a compile between two same-fingerprint sources,
// and the fingerprint below still separates every compile-input combination.
const hashSource = (source: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
};

interface BuildCacheKeyInput {
  templatePath: string;
  templateName: string;
  source: string;
  config: RenderConfig;
}

// WHY: the key carries EVERY input compileToCode consumes — path + name + a
// content hash of the source + the compile-affecting config fields. Because the
// source content itself is part of the key, a rewritten file lands on a fresh key on
// the next render: staleness is structurally impossible, no watcher needed.
// Extensions key by their MAP KEYS (parse-dispatch surface) — closure bodies are not
// serializable, and a host mutating a registered extension's behavior in place has the
// same aliasing hazard with or without a cache.
const buildCompileCacheKey = ({
  templatePath,
  templateName,
  source,
  config,
}: BuildCacheKeyInput): string =>
  [
    templatePath,
    templateName,
    hashSource(source),
    config.undefined ?? 'default',
    config.trimBlocks ? 't' : '-',
    config.lstripBlocks ? 'l' : '-',
    config.streamErrorRecovery ? 'r' : '-',
    config.extensions ? Object.keys(config.extensions).toSorted().join('+') : '-',
  ].join('::');

/** Minimal LRU surface the engine consumes from a compiled-code cache. */
interface CompiledCodeCache {
  get: (key: string) => string | undefined;
  set: (key: string, code: string) => void;
  clear: () => void;
  readonly size: number;
}

/** Options for `createTemplateCache` — the LRU entry bound. */
interface TemplateCacheOptions {
  // WHY: bounded LRU — an engine rendering unbounded distinct templates must not grow
  // the cache without limit; insertion order of the Map IS the recency list.
  maxEntries?: number;
}

/**
 * Creates a bounded LRU compiled-code cache — Map insertion order doubles as
 * the recency list, and reads re-insert to keep hot entries fresh.
 */
const createTemplateCache = ({
  maxEntries = 100,
}: TemplateCacheOptions = {}): CompiledCodeCache => {
  const entries = new Map<string, string>();

  const get = (key: string): string | undefined => {
    const hit = entries.get(key);
    if (hit !== undefined) {
      // LRU touch: re-insert so the key moves to the freshest position.
      entries.delete(key);
      entries.set(key, hit);
    }
    return hit;
  };

  const set = (key: string, code: string): void => {
    entries.delete(key);
    entries.set(key, code);
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      entries.delete(oldest);
    }
  };

  return {
    get,
    set,
    clear: () => entries.clear(),
    get size() {
      return entries.size;
    },
  };
};

export type { CompiledCodeCache, TemplateCacheOptions };
export { buildCompileCacheKey, createTemplateCache };
