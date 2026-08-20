interface ExtractWhileOptions {
  source: string;
  start: number;
  allowed: ReadonlySet<string>;
}

/**
 * Extracts the run of characters starting at `start` while they stay inside the allowed
 * set; the scan stops at EOF or the first disallowed character.
 */
export const extractWhile = ({ source, start, allowed }: ExtractWhileOptions): string => {
  // WHY: while loop instead of the previous per-character recursion — long character
  // runs overflowed the native stack. Loop exemption: lexer/tokenizer engine.
  let end = start;
  while (end < source.length && allowed.has(source[end] ?? '')) {
    end += 1;
  }
  return source.slice(start, end);
};

interface ExtractUntilOptions {
  source: string;
  start: number;
  terminators: ReadonlySet<string>;
}

/**
 * Extracts the run of characters starting at `start` until one appears in the
 * terminator set; the scan stops at EOF or the first terminating character.
 */
export const extractUntil = ({ source, start, terminators }: ExtractUntilOptions): string => {
  // WHY: while loop instead of the previous per-character recursion — long symbol runs
  // overflowed the native stack. Loop exemption: lexer/tokenizer engine.
  let end = start;
  while (end < source.length && !terminators.has(source[end] ?? '')) {
    end += 1;
  }
  return source.slice(start, end);
};

interface ParseStringContentOptions {
  source: string;
  start: number;
  quote: string;
}

/**
 * Extracts string content up to the closing `quote`, skipping backslash escape pairs
 * wholesale so an escaped quote does not terminate the literal; an EOF-bounded slice
 * is returned when the quote is never reached.
 */
export const parseStringContent = ({ source, start, quote }: ParseStringContentOptions): string => {
  // WHY: while loop instead of the previous per-character recursion — long string
  // literals overflowed the native stack. Loop exemption: lexer/tokenizer engine. An
  // escaped character (backslash pair) is skipped wholesale so an escaped quote does
  // not terminate the content.
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
