import { isNonNullish } from 'remeda';

interface NormalizeIndexInput {
  idx: number | null;
  len: number;
  defaultVal: number;
  step: number;
}

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

const collectForward = ({ source, start, stop, step }: SliceCollectInput): readonly unknown[] => {
  const drain = (index: number, acc: unknown[]): readonly unknown[] => {
    if (index >= stop) { return acc; }
    return drain(index + step, [...acc, source[index]]);
  };
  return drain(start, []);
};

const collectBackward = ({ source, start, stop, step }: SliceCollectInput): readonly unknown[] => {
  const drain = (index: number, acc: unknown[]): readonly unknown[] => {
    if (index < 0 || index <= stop) { return acc; }
    return drain(index + step, [...acc, source[index]]);
  };
  return drain(start, []);
};

export { normalizeIndex, collectForward, collectBackward };