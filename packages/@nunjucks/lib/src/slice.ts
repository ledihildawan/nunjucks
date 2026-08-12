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

interface SliceCollectInput<T> {
  source: readonly T[] | string;
  start: number;
  stop: number;
  step: number;
}

const collectForward = <T>({ source, start, stop, step }: SliceCollectInput<T>): readonly T[] => {
  const drain = (index: number, acc: T[]): readonly T[] => {
    if (index >= stop) { return acc; }
    return drain(index + step, [...acc, source[index] as T]);
  };
  return drain(start, []);
};

const collectBackward = <T>({ source, start, stop, step }: SliceCollectInput<T>): readonly T[] => {
  const drain = (index: number, acc: T[]): readonly T[] => {
    if (index < 0 || index <= stop) { return acc; }
    return drain(index + step, [...acc, source[index] as T]);
  };
  return drain(start, []);
};

export { normalizeIndex, collectForward, collectBackward };