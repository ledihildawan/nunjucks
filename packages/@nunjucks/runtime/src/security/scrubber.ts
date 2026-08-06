import { keys } from 'remeda';
import { isDangerousReference } from '@nunjucks/shared';

const visitAndScrub = (value: unknown, seen: WeakSet<object>): unknown => {
  if (value === null || typeof value !== 'object') { return value; }
  if (seen.has(value)) { return value; }
  if (Array.isArray(value)) {
    seen.add(value);
    return value.map(item => visitAndScrub(item, seen));
  }
  seen.add(value);
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    keys(record)
      .filter(key => !isDangerousReference(record[key]))
      .map(key => [key, visitAndScrub(record[key], seen)])
  );
};

export const scrubDangerousReferences = (context: unknown, _allowedGlobals: readonly string[] | null): unknown => {
  const seen = new WeakSet<object>();
  return visitAndScrub(context, seen);
};

export { visitAndScrub };
