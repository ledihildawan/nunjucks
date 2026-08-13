import { keys } from 'remeda';
import { isKeyedObject } from '@nunjucks/lib';
import { isDangerousReference } from './context-security.ts';

const visitAndScrub = (value: unknown, seen: WeakSet<object>): unknown => {
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

export const scrubDangerousReferences = <T>(context: T): T => {
  const seen = new WeakSet<object>();
  // WHY: visitAndScrub returns `unknown` because it rebuilds objects via
  // Object.fromEntries. The structural invariant it upholds: for non-dangerous
  // inputs every key is preserved with its (recursively scrubbed) value, so the
  // result is structurally assignable back to T. Dangerous keys are *removed*,
  // making the result a structural subtype of T — never a supertype — so the
  // cast is a sound upper bound. TS cannot prove the round-trip, hence the cast.
  return visitAndScrub(context, seen) as T;
};

export { visitAndScrub };
