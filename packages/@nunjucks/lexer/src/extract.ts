interface ExtractWhileOptions {
  str: string;
  start: number;
  chars: string;
}

export const extractWhile = ({ str, start, chars }: ExtractWhileOptions): string => {
  const findEnd = (end: number): number => {
    if (end >= str.length || !chars.includes(str[end] ?? '')) { return end; }
    return findEnd(end + 1);
  };
  return str.slice(start, findEnd(start));
};

interface ExtractUntilOptions {
  str: string;
  start: number;
  chars: string;
}

export const extractUntil = ({ str, start, chars }: ExtractUntilOptions): string => {
  const findEnd = (end: number): number => {
    if (end >= str.length || chars.includes(str[end] ?? '')) { return end; }
    return findEnd(end + 1);
  };
  return str.slice(start, findEnd(start));
};

interface ParseStringContentOptions {
  str: string;
  start: number;
  quote: string;
}

export const parseStringContent = ({
  str,
  start,
  quote,
}: ParseStringContentOptions): string => {
  const findEnd = (end: number): number => {
    if (end >= str.length) { return end; }
    const char = str[end] ?? '';
    if (char === quote) { return end; }
    if (char === '\\' && end + 1 < str.length) { return findEnd(end + 2); }
    return findEnd(end + 1);
  };
  return str.slice(start, findEnd(start));
};
