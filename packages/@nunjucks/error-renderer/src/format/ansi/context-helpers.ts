import { pipe, keys, map } from 'remeda';
import { normalizeRenderContext } from '../presentation/error/safe-context.ts';
import { sanitizeForAnsi } from './sanitize-helpers.ts';

export { formatContextValue, renderContextAnsi };

const INDENT = '  ';

const formatContextValue = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) {
    return sanitizeForAnsi(value);
  }
  if (Array.isArray(value)) {
    return sanitizeForAnsi(value);
  }
  const record = value as Record<string, unknown>;
  const entries = pipe(record, keys(), map(key => `${INDENT}${key}: ${sanitizeForAnsi(record[key])}`));
  if (entries.length === 0) {
    return '(empty)';
  }
  return `:\n${entries.join('\n')}`;
};

const renderContextAnsi = (context: Record<string, unknown>, blockedKeys?: readonly string[] | null): string => {
  const normalized = normalizeRenderContext(context, { blockedKeys });
  const header = `\n${picocolors.bold('Render Context:')}\n`;
  if (typeof normalized !== 'object' || normalized === null) {
    return header;
  }
  const record = normalized as Record<string, unknown>;
  const entries = pipe(record, keys(), map(key => `${INDENT}${key} ${formatContextValue(record[key])}`));
  return header + entries.join('\n');
};

import picocolors from 'picocolors';
