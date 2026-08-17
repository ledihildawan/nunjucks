const FALLBACK_CARET_WIDTH = 3;

interface CaretResult {
  wordStart: number;
  wordEnd: number;
  highlightWord: string;
  carets: string;
}

const WORD_CHAR_RE = /[\w./\\-]/u;
const PATH_SEPARATOR_RE = /[\\/-]/u;
const FILE_EXTENSION_RE =
  /\.(?:njk|nunjucks|html?|tmpl|tpl|js|ts|mjs|cjs|jsx|tsx|json|ya?ml|css|scss|sass|less|md|txt)$/iu;
const WHITESPACE_RE = /\s/u;

const isWordChar = (char: string | undefined): boolean => WORD_CHAR_RE.test(char ?? '');

const isPathLike = (word: string): boolean =>
  PATH_SEPARATOR_RE.test(word) || FILE_EXTENSION_RE.test(word);

const findWordStart = (line: string, wordEnd: number): number => {
  const scanLeft = (pos: number): number => {
    if (!(pos > 0 && isWordChar(line[pos - 1]))) {
      return pos;
    }
    return scanLeft(pos - 1);
  };
  return scanLeft(wordEnd - 2);
};

const findWordEnd = (line: string, pos: number): number => {
  const scanRight = (currentPos: number): number => {
    if (!(currentPos < line.length && isWordChar(line[currentPos]))) {
      return currentPos;
    }
    return scanRight(currentPos + 1);
  };
  return scanRight(pos);
};

const findNonWordLeft = (line: string, pos: number): number => {
  const scanLeft = (searchLeft: number): number => {
    if (!(searchLeft >= 0 && !isWordChar(line[searchLeft]))) {
      return searchLeft;
    }
    return scanLeft(searchLeft - 1);
  };
  return scanLeft(pos - 1);
};

const findWordBoundaries = (line: string, pos: number): { wordStart: number; wordEnd: number } => {
  if (!isWordChar(line[pos])) {
    return { wordStart: pos, wordEnd: pos };
  }
  const wordEnd = findWordEnd(line, pos);
  const wordStart = findWordStart(line, wordEnd);
  return { wordStart, wordEnd };
};

interface DotPathSegmentInput {
  highlightWord: string;
  wordStart: number;
  relativePos: number;
}

const findSegmentInDotPath = ({
  highlightWord,
  wordStart,
  relativePos,
}: DotPathSegmentInput): { wordStart: number; wordEnd: number; highlightWord: string } | null => {
  const segments = highlightWord.split('.');
  const { found } = segments.reduce<{
    found: { wordStart: number; wordEnd: number; highlightWord: string } | null;
    offset: number;
  }>(
    (acc, segment) => {
      if (acc.found) {
        return acc;
      }
      const segmentStart = wordStart + acc.offset;
      const segmentEnd = segmentStart + segment.length;
      const matched = relativePos >= acc.offset && relativePos <= acc.offset + segment.length;
      return {
        found: matched
          ? { wordStart: segmentStart, wordEnd: segmentEnd, highlightWord: segment }
          : null,
        offset: acc.offset + segment.length + 1,
      };
    },
    { found: null, offset: 0 }
  );
  return found;
};

interface ResolveHighlightWordInput {
  line: string;
  pos: number;
  wordStart: number;
  wordEnd: number;
}

const resolveHighlightWord = ({
  line,
  pos,
  wordStart,
  wordEnd,
}: ResolveHighlightWordInput): { wordStart: number; wordEnd: number; highlightWord: string } => {
  const highlightWord = line.slice(wordStart, wordEnd);
  if (highlightWord?.includes('.') && !isPathLike(highlightWord)) {
    const relativePos = pos - wordStart;
    const result = findSegmentInDotPath({ highlightWord, wordStart, relativePos });
    if (result) {
      return result;
    }
  }
  return { wordStart, wordEnd, highlightWord };
};

const buildCarets = (highlightWord: string): string => {
  if (highlightWord) {
    return '^'.repeat(highlightWord.length);
  }
  return '^'.repeat(FALLBACK_CARET_WIDTH);
};

/**
 * Computes the caret underline for an error position: expands to the enclosing word
 * (narrowing dotted paths to the pointed-at segment), falls back to a single `^` on
 * punctuation and `FALLBACK_CARET_WIDTH` carets when no word is found. Returns `null`
 * for non-positive columns or empty lines.
 */
const calculateCaretPosition = (line: string, displayCol: number): CaretResult | null => {
  if (displayCol <= 0 || !line) {
    return null;
  }

  const rawPos = displayCol - 1;
  const rawCharAtPos = line[rawPos];

  if (!isWordChar(rawCharAtPos) && rawCharAtPos && !WHITESPACE_RE.test(rawCharAtPos)) {
    return {
      wordStart: rawPos,
      wordEnd: rawPos + 1,
      highlightWord: rawCharAtPos,
      carets: '^',
    };
  }

  const searchLeft = !isWordChar(rawCharAtPos) ? findNonWordLeft(line, rawPos) : rawPos;
  const pos =
    !isWordChar(rawCharAtPos) && searchLeft >= 0 && isWordChar(line[searchLeft])
      ? searchLeft
      : rawPos;

  const { wordStart: initialStart, wordEnd: initialEnd } = findWordBoundaries(line, pos);
  const { wordStart, wordEnd, highlightWord } = resolveHighlightWord({
    line,
    pos,
    wordStart: initialStart,
    wordEnd: initialEnd,
  });
  const carets = buildCarets(highlightWord);

  return { wordStart, wordEnd, highlightWord, carets };
};

export type { CaretResult };
export { calculateCaretPosition };
