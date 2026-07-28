import { keys } from 'remeda';
import { normalizeRenderContext } from '../internal/safe-context.ts';
import { sanitizeForAnsi } from './sanitize-helpers';

export { formatContextValue, renderContextAnsi };

const INDENT = '  ';

const formatContextValue = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) {
    return sanitizeForAnsi(value);
  }
  if (Array.isArray(value)) {
    return sanitizeForAnsi(value);
  }
  const obj = value as Record<string, unknown>;
  const k = keys(obj);
  if (k.length === 0) {
    return '(empty)';
  }
  const entries = k.map(key => `${INDENT}${key}: ${sanitizeForAnsi(obj[key])}`).join('\n');
  return `:\n${entries}`;
};

const renderContextAnsi = (context: Record<string, unknown>): string => {
  const normalized = normalizeRenderContext(context);
  const header = `\n${picocolors.bold('Render Context:')}\n`;
  if (typeof normalized !== 'object' || normalized === null) {
    return header;
  }
  const record = normalized as Record<string, unknown>;
  const entries = keys(record).map(key => `${INDENT}${key} ${formatContextValue(record[key])}`);
  return header + entries.join('\n');
};

import picocolors from 'picocolors';
