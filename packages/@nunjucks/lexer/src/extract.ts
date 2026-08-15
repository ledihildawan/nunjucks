interface ExtractWhileOptions {
  source: string;
  start: number;
  chars: string;
}

export const extractWhile = ({ source, start, chars }: ExtractWhileOptions): string => {
  const findEnd = (end: number): number => {
    if (end >= source.length || !chars.includes(source[end] ?? '')) {
      return end;
    }
    return findEnd(end + 1);
  };
  return source.slice(start, findEnd(start));
};

interface ExtractUntilOptions {
  source: string;
  start: number;
  chars: string;
}

export const extractUntil = ({ source, start, chars }: ExtractUntilOptions): string => {
  const findEnd = (end: number): number => {
    if (end >= source.length || chars.includes(source[end] ?? '')) {
      return end;
    }
    return findEnd(end + 1);
  };
  return source.slice(start, findEnd(start));
};

interface ParseStringContentOptions {
  source: string;
  start: number;
  quote: string;
}

export const parseStringContent = ({ source, start, quote }: ParseStringContentOptions): string => {
  const findEnd = (end: number): number => {
    if (end >= source.length) {
      return end;
    }
    const char = source[end] ?? '';
    if (char === quote) {
      return end;
    }
    if (char === '\\' && end + 1 < source.length) {
      return findEnd(end + 2);
    }
    return findEnd(end + 1);
  };
  return source.slice(start, findEnd(start));
};
