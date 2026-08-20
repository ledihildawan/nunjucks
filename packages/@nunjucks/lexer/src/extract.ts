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
 * is returned when the quote is never reached. The RAW text is returned — escape
 * decoding is `decodeStringEscapes`'s job.
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

/**
 * Decodes backslash escape pairs in raw string content, mirroring the original
 * lexer's `_parseString` switch: `\n`/`\t`/`\r` become real control characters and
 * every other escape drops the backslash, keeping the bare character.
 */
export const decodeStringEscapes = (raw: string): string => {
  // WHY: while loop instead of per-character recursion — long escaped literals
  // overflowed the native stack. Loop exemption: lexer/tokenizer engine.
  let decoded = '';
  let index = 0;
  while (index < raw.length) {
    const char = raw[index] ?? '';
    if (char !== '\\' || index + 1 >= raw.length) {
      decoded += char;
      index += 1;
      continue;
    }
    switch (raw[index + 1]) {
      case 'n':
        decoded += '\n';
        break;
      case 't':
        decoded += '\t';
        break;
      case 'r':
        decoded += '\r';
        break;
      default:
        decoded += raw[index + 1] ?? '';
    }
    index += 2;
  }
  return decoded;
};
