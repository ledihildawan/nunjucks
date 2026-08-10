import { keys } from 'remeda';
import { isKeyedObject } from '../type-guards.ts';
import { isDangerousReference } from './context-security.ts';

const visitAndScrub = (value: unknown, seen: WeakSet<object>): unknown => {
  // WHY: isKeyedObject narrows unknown → Record<PropertyKey, unknown> without excluding arrays;
  // the explicit Array.isArray branch handles element-wise recursion before the record walk.
  if (!isKeyedObject(value)) { return value; }
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

export const scrubDangerousReferences = (context: unknown): unknown => {
  const seen = new WeakSet<object>();
  return visitAndScrub(context, seen);
};

export { visitAndScrub };