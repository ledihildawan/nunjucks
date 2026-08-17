import { isNonNullish } from 'remeda';

interface NormalizeIndexInput {
  idx: number | null;
  len: number;
  defaultVal: number;
  step: number;
}

/**
 * Resolves a slice boundary against length `len`: a missing index falls back
 * to `defaultVal` (steered by `step` direction), negative indexes count from
 * the end, and the result is clamped to `[0, len]`.
 */
const normalizeIndex = ({ idx, len, defaultVal, step }: NormalizeIndexInput): number => {
  if (!isNonNullish(idx)) {
    if (step < 0) {
      return defaultVal === 0 ? len - 1 : -1;
    }
    return defaultVal;
  }
  return Math.max(0, Math.min(len, idx < 0 ? len + idx : idx));
};

interface SliceCollectInput {
  source: readonly unknown[] | string;
  start: number;
  stop: number;
  step: number;
}

// WHY: push-accumulator while loops instead of the previous `[...acc, x]` recursion —
// per-element recursion overflowed the native stack on long stepped slices and the
// spread copies made collection O(n²). Loop exemption: recursion-safety (§3),
// mirroring collect-stream.ts.
const collectForward = ({ source, start, stop, step }: SliceCollectInput): readonly unknown[] => {
  const collected: unknown[] = [];
  for (let index = start; index < stop; index += step) {
    collected.push(source[index]);
  }
  return collected;
};

/**
 * Collects a stepped slice in reverse index order: walks from `start` down to
 * the exclusive `stop` while staying non-negative, pushing into an array
 * (loop instead of recursion for stack safety on long slices).
 */
const collectBackward = ({ source, start, stop, step }: SliceCollectInput): readonly unknown[] => {
  const collected: unknown[] = [];
  for (let index = start; index > stop && index >= 0; index += step) {
    collected.push(source[index]);
  }
  return collected;
};

export { normalizeIndex, collectForward, collectBackward };
