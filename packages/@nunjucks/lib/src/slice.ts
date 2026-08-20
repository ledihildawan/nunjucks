import { isNonNullish } from 'remeda';

interface NormalizeIndexInput {
  index: number | null;
  length: number;
  defaultValue: number;
  step: number;
}

/**
 * Resolves a slice boundary against the collection `length`: a missing index
 * falls back to `defaultValue` (steered by `step` direction), negative indexes
 * count from the end, and the result is clamped to `[0, length]`.
 */
const normalizeIndex = ({ index, length, defaultValue, step }: NormalizeIndexInput): number => {
  if (!isNonNullish(index)) {
    if (step < 0) {
      return defaultValue === 0 ? length - 1 : -1;
    }
    return defaultValue;
  }
  return Math.max(0, Math.min(length, index < 0 ? length + index : index));
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
