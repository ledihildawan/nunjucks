interface ExtractWhileOptions {
  source: string;
  start: number;
  chars: string;
}

export const extractWhile = ({ source, start, chars }: ExtractWhileOptions): string => {
  // WHY: while loop instead of the previous per-character recursion — long character
  // runs overflowed the native stack. Loop exemption: lexer/tokenizer engine, per
  // ARCHITECTURE.md.
  let end = start;
  while (end < source.length && chars.includes(source[end] ?? '')) {
    end += 1;
  }
  return source.slice(start, end);
};

interface ExtractUntilOptions {
  source: string;
  start: number;
  chars: string;
}

export const extractUntil = ({ source, start, chars }: ExtractUntilOptions): string => {
  // WHY: while loop instead of the previous per-character recursion — long symbol runs
  // overflowed the native stack. Loop exemption: lexer/tokenizer engine, per
  // ARCHITECTURE.md.
  let end = start;
  while (end < source.length && !chars.includes(source[end] ?? '')) {
    end += 1;
  }
  return source.slice(start, end);
};

interface ParseStringContentOptions {
  source: string;
  start: number;
  quote: string;
}

export const parseStringContent = ({ source, start, quote }: ParseStringContentOptions): string => {
  // WHY: while loop instead of the previous per-character recursion — long string
  // literals overflowed the native stack. Loop exemption: lexer/tokenizer engine, per
  // ARCHITECTURE.md. An escaped character (backslash pair) is skipped wholesale so an
  // escaped quote does not terminate the content.
  let end = start;
  while (end < source.length) {
    const char = source[end] ?? '';
    if (char === quote) {
      break;
    }
    if (char === '\\' && end + 1 < source.length) {
      end += 2;
      continue;
    }
    end += 1;
  }
  return source.slice(start, end);
};
