import type { DomPurifyConfig } from '@nunjucks/shared';

// WHY: filters/globals/tests/extensions are dynamic user-supplied callables/values. `unknown` mirrors
// GlobalConfig's FilterObject and avoids contravariance friction on specific filter signatures.
type ExtensionMap = Readonly<Record<string, unknown>>;

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

interface FoldedPlugins {
  readonly filters: ExtensionMap;
  readonly globals: ExtensionMap;
  readonly tests: ExtensionMap;
  readonly extensions: ExtensionMap;
  readonly dompurify: DomPurifyConfig | undefined;
}

const emptyFold: FoldedPlugins = {
  filters: {},
  globals: {},
  tests: {},
  extensions: {},
  dompurify: undefined,
};

// WHY: fold plugins left-to-right so a later plugin overrides an earlier one's same-named filter/global/etc.
// (declarative reduce per Rule 2). The factory then layers the user's direct filters/globals/tests/extensions
// on top of this folded result, which in turn sit above the built-in default filter bundle.
const foldPlugins = (plugins: readonly NunjucksPlugin[] = []): FoldedPlugins =>
  plugins.reduce<FoldedPlugins>(
    (folded, plugin) => ({
      filters: { ...folded.filters, ...plugin.filters },
      globals: { ...folded.globals, ...plugin.globals },
      tests: { ...folded.tests, ...plugin.tests },
      extensions: { ...folded.extensions, ...plugin.extensions },
      dompurify: plugin.dompurify ?? folded.dompurify,
    }),
    emptyFold,
  );

export { foldPlugins };
export type { NunjucksPlugin, FoldedPlugins };
