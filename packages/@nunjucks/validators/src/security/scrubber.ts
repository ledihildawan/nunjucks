import { isKeyedObject } from '@nunjucks/lib';
import { keys } from 'remeda';
import { isDangerousReference } from '@nunjucks/shared';

const visitAndScrub = (value: unknown, seen: WeakSet<object>): unknown => {
  if (!isKeyedObject(value)) {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    seen.add(value);
    return value.map((item) => visitAndScrub(item, seen));
  }
  seen.add(value);
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    keys(record)
      .filter((key) => !isDangerousReference(record[key]))
      .map((key) => [key, visitAndScrub(record[key], seen)])
  );
};

// WHY: accepts `unknown` — the scrubber is applied to untrusted render-context shapes and
// returns non-objects untouched (pinned by tests); the generic `T → T` it replaced was
// phantom (every caller passed Record<string, unknown>) and asserted more than it proved.
export const scrubDangerousReferences = (context: unknown): unknown => {
  const seen = new WeakSet<object>();
  // WHY: visitAndScrub rebuilds objects via Object.fromEntries. The structural invariant it
  // upholds: for non-dangerous inputs every key is preserved with its (recursively scrubbed)
  // value, so the result is structurally assignable back to the input's shape. Dangerous keys
  // are *removed*, making the result a structural subtype — never a supertype — so the cast
  // is a sound upper bound. TS cannot prove the round-trip, hence the cast.
  return visitAndScrub(context, seen);
};

export { visitAndScrub };
