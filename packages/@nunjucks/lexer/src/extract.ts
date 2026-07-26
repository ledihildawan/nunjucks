import { WHITESPACE_CHARS, DELIM_CHARS } from './constants.ts';

export const extractWhile = (str: string, start: number, chars: string): string => {
  let end = start;
  while (end < str.length && chars.includes(str[end] ?? '')) { end += 1; }
  return str.slice(start, end);
};

export const extractUntil = (str: string, start: number, chars: string): string => {
  let end = start;
  while (end < str.length && !chars.includes(str[end] ?? '')) { end += 1; }
  return str.slice(start, end);
};

export const parseStringContent = (
  str: string,
  start: number,
  quote: string
): string => {
  let end = start;
  while (end < str.length && (str[end] ?? '') !== quote) {
    if ((str[end] ?? '') === '\\' && end + 1 < str.length) { end += 1; }
    end += 1;
  }
  return str.slice(start, end);
};

export const extractSymbol = (str: string, start: number): string =>
  extractUntil(str, start, WHITESPACE_CHARS + DELIM_CHARS);
