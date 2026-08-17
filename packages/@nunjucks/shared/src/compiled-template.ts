import { filter, map, pipe } from 'remeda';

/**
 * Freezes the reserved property name under which compiled templates stash block metadata —
 * single-sourced here so emitter and loader agree without a shared runtime import.
 */
export const BLOCK_META_KEY = '__blockMeta';

/**
 * Defines the async-generator render contract every compiled template's `root` (and each
 * `b_`-prefixed block) satisfies — each `yield` contributes one output chunk as a string.
 */
export type CompiledRenderSignature = (
  env: unknown,
  context: unknown,
  frame: unknown,
  runtime: unknown
) => AsyncGenerator<string, unknown>;

type CompiledBlockSignature = (
  env: unknown,
  context: unknown,
  frame: unknown,
  runtime: unknown
) => AsyncGenerator<string, unknown>;

/**
 * Defines the module namespace of a compiled template: a required `root` renderer plus
 * `b_`-prefixed block exports and the `__blockMeta` metadata record.
 */
export interface CompiledTemplateExports {
  root: CompiledRenderSignature;
  [blockName: string]: CompiledRenderSignature | CompiledBlockSignature | Record<string, unknown>;
  [BLOCK_META_KEY]: Record<string, unknown>;
}

/**
 * Narrows `value` to `CompiledTemplateExports` — deliberately shallow, checking only that
 * `root` is a function; block exports and metadata are trusted past this guard.
 */
export const isCompiledTemplateExports = (value: unknown): value is CompiledTemplateExports => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return typeof (value as { root?: unknown }).root === 'function';
};

/**
 * Collects the `b_`-prefixed block exports of a compiled module, stripped of their prefix
 * into plain block names — only top-level keys are considered, with no nesting.
 */
export const extractBlocks = (source: Record<string, unknown>): Partial<Record<string, unknown>> =>
  pipe(
    Object.entries(source),
    filter(([key]: readonly [string, unknown]) => key.startsWith('b_')),
    map(([key, value]: readonly [string, unknown]) => [key.slice(2), value]),
    Object.fromEntries
  ) as Partial<Record<string, unknown>>;
