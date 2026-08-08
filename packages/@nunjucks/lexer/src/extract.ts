export const extractWhile = (str: string, start: number, chars: string): string => {
  const findEnd = (end: number): number => {
    if (end >= str.length || !chars.includes(str[end] ?? '')) { return end; }
    return findEnd(end + 1);
  };
  return str.slice(start, findEnd(start));
};

export const extractUntil = (str: string, start: number, chars: string): string => {
  const findEnd = (end: number): number => {
    if (end >= str.length || chars.includes(str[end] ?? '')) { return end; }
    return findEnd(end + 1);
  };
  return str.slice(start, findEnd(start));
};

export const parseStringContent = (
  str: string,
  start: number,
  quote: string
): string => {
  const findEnd = (end: number): number => {
    if (end >= str.length) { return end; }
    const char = str[end] ?? '';
    if (char === quote) { return end; }
    if (char === '\\' && end + 1 < str.length) { return findEnd(end + 2); }
    return findEnd(end + 1);
  };
  return str.slice(start, findEnd(start));
};
