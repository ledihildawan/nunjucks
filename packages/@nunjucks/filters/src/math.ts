import { makeMacro } from '@nunjucks/runtime';

export const abs = Math.abs;

export function isNaN(num: unknown): boolean {
  return num !== num;
}

export function round(val: number, precision: number = 0, method?: 'ceil' | 'floor' | 'round'): number {
  precision = precision || 0;
  const factor = Math.pow(10, precision);
  let rounder: (x: number) => number;

  if (method === 'ceil') {
    rounder = Math.ceil;
  } else if (method === 'floor') {
    rounder = Math.floor;
  } else {
    rounder = Math.round;
  }

  return rounder(val * factor) / factor;
}

export function float(val: unknown, def?: number): number {
  const res = parseFloat(String(val));
  return (isNaN(res)) ? (def as number) : res;
}

export const intFilter = makeMacro(
  ['value', 'default', 'base'],
  [],
  function doInt(value: unknown, defaultValue?: number, base: number = 10): number {
    const res = parseInt(String(value), base);
    return (isNaN(res)) ? (defaultValue as number) : res;
  }
);

export const int = intFilter;
