import { getError } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';

type FilterFunction = (...args: unknown[]) => unknown;

/** Callable table (`filters`/`globals`) — name to function, built from user config. */
type FilterMap = Record<string, FilterFunction>;

const isCallableEntry = (
  entry: readonly [string, unknown]
): entry is readonly [string, FilterFunction] => typeof entry[1] === 'function';

interface PartitionedCallableEntries {
  callableEntries: readonly (readonly [string, FilterFunction])[];
  invalidNames: readonly string[];
}

const partitionCallableEntries = (
  entries: readonly (readonly [string, unknown])[]
): PartitionedCallableEntries => ({
  callableEntries: entries.filter(isCallableEntry),
  invalidNames: entries.filter((entry) => !isCallableEntry(entry)).map(([name]) => name),
});

const createInvalidCallableError = (
  configKey: string,
  invalidNames: readonly string[]
): TemplateError =>
  createLog('error', {
    def: {
      ...getError('INVALID_CONFIG'),
      message: () =>
        `Invalid configuration: ${configKey} entries must be functions (non-function entries: ${invalidNames.join(', ')})`,
    },
    params: {},
    subject: invalidNames.join(', '),
    context: { phase: 'render', lineBase: 'zero' },
  });

/**
 * Validates an unknown config object into a callable map, returning `err` listing
 * the offending names when any entry is not a function.
 */
const buildCallableMap = (source: unknown, configKey: string): Result<FilterMap, TemplateError> => {
  const { callableEntries, invalidNames } = partitionCallableEntries(
    typeof source === 'object' && source !== null ? Object.entries(source) : []
  );
  return invalidNames.length > 0
    ? err(createInvalidCallableError(configKey, invalidNames))
    : ok(Object.fromEntries(callableEntries));
};

export type { FilterMap };
export { buildCallableMap };
