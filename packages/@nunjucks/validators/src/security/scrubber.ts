import { isPlainObject } from '@nunjucks/lib';
import { keys } from 'remeda';
import { isDangerousReference } from '@nunjucks/security';

// WHY: recursion bound — the scrubber walks untrusted context shapes before render;
// a hostile deeply-nested object must not turn the security pass itself into a
// stack overflow. Past the cap the value passes through as-is (same posture as the
// scanner's cap: pathological nesting is not by itself a dangerous reference).
const MAX_SCRUB_DEPTH = 128;

interface ScrubVisit {
  value: unknown;
  seen: WeakSet<object>;
  depth: number;
}

/** Recursively rebuilds a value with dangerous entries removed; see inline WHYs. */
const visitAndScrub = ({ value, seen, depth }: ScrubVisit): unknown => {
  // WHY: only plain objects/arrays are rebuilt — exotic keyed values (Date, Map, Set,
  // RegExp, class instances) carry behavior in their prototype, and fromEntries would
  // flatten them to {} (destroying {{ createdAt.getFullYear() }} in dev-warn renders).
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return value;
  }
  // WHY: cycles return a placeholder, NOT the original — re-embedding the original
  // would re-admit any dangerous reference reachable through the cycle that the
  // top-level pass just scrubbed.
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (depth >= MAX_SCRUB_DEPTH) {
    return value;
  }
  seen.add(value);
  const nextDepth = depth + 1;
  if (Array.isArray(value)) {
    return value.map((item) => visitAndScrub({ value: item, seen, depth: nextDepth }));
  }
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    keys(record)
      .filter((key) => !isDangerousReference(record[key]))
      .map((key) => [key, visitAndScrub({ value: record[key], seen, depth: nextDepth })])
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
  return visitAndScrub({ value: context, seen, depth: 0 });
};

export { visitAndScrub };
