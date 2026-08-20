import type { DomPurifyConfig } from '@nunjucks/shared';
import type { ExtensionMap } from '../config/nunjucks-config.ts';

// WHY: a plugin is a composable bundle of template extensions — filters, globals, tests, custom-tag
// extensions, and dompurify config — installed as a unit via the factory's `plugins: [...]` option. Mirrors
// the existing FilterBundle concept (config/global.ts) but generalized. Later plugins (and the user's own
// filters/globals) layer ON TOP of earlier ones, matching the established `{ ...defaults, ...user }` merge.
interface NunjucksPlugin {
  readonly name?: string;
  readonly filters?: ExtensionMap;
  readonly globals?: ExtensionMap;
  readonly tests?: ExtensionMap;
  readonly extensions?: ExtensionMap;
  readonly dompurify?: DomPurifyConfig;
}

/** Result of folding a plugin list — merged maps plus the last `dompurify` config. */
interface FoldedPlugins {
  readonly filters: ExtensionMap;
  readonly globals: ExtensionMap;
  readonly tests: ExtensionMap;
  readonly extensions: ExtensionMap;
  readonly dompurify: DomPurifyConfig | undefined;
}

// WHY: fresh FROZEN folds per call — a module-level shared `emptyFold` let one consumer's
// mutation of `folded.filters` poison every later foldPlugins result (shared mutable
// state across calls). Freshness isolates calls; freezing turns an accidental mutation
// into a loud failure instead of silent cross-call contamination.
const createEmptyFold = (): FoldedPlugins => ({
  filters: Object.freeze({}),
  globals: Object.freeze({}),
  tests: Object.freeze({}),
  extensions: Object.freeze({}),
  dompurify: undefined,
});

// WHY: drop malformed (null/undefined) extension values at fold time rather than letting them surface as
// a runtime cast failure during render. Filters/tests must be callables (enforced by config validation);
// extensions are objects; globals may be any non-null value. A `null`/`undefined` entry is always a
// plugin-author bug, so we strip it here — closing the §5 plugin-value boundary gap noted in the audit.
const isUsableExtensionValue = (value: unknown): boolean => value !== null && value !== undefined;

const mergeExtensions = (
  folded: ExtensionMap,
  incoming: ExtensionMap | undefined
): ExtensionMap => {
  if (!incoming) {
    return folded;
  }
  const merged = Object.fromEntries(
    Object.entries({ ...folded, ...incoming }).filter(([, value]) => isUsableExtensionValue(value))
  );
  return Object.freeze(merged);
};

// WHY: fold plugins left-to-right so a later plugin overrides an earlier one's same-named filter/global/etc.
// (declarative reduce per Rule 2). The factory then layers the user's direct filters/globals/tests/extensions
// on top of this folded result, which in turn sit above the built-in default filter bundle.
/**
 * Folds plugins left-to-right into one bundle — a later plugin overrides an
 * earlier one's same-named entry; malformed values drop at fold time. Every
 * returned map is fresh and frozen per call.
 */
const foldPlugins = (plugins: readonly NunjucksPlugin[] = []): FoldedPlugins =>
  plugins.reduce<FoldedPlugins>(
    (folded, plugin) => ({
      filters: mergeExtensions(folded.filters, plugin.filters),
      globals: mergeExtensions(folded.globals, plugin.globals),
      tests: mergeExtensions(folded.tests, plugin.tests),
      extensions: mergeExtensions(folded.extensions, plugin.extensions),
      dompurify: plugin.dompurify ?? folded.dompurify,
    }),
    createEmptyFold()
  );

export type { FoldedPlugins, NunjucksPlugin };
export { foldPlugins };
