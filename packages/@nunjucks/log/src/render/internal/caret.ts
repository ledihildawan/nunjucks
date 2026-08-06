/** Width of the caret run when no word could be identified to underline. */
const FALLBACK_CARET_WIDTH = 3;

interface CaretResult {
  wordStart: number;
  wordEnd: number;
  highlightWord: string;
  carets: string;
}

const WORD_CHAR_RE = /[\w./\\-]/u;
const PATH_SEPARATOR_RE = /[\\/-]/u;
const FILE_EXTENSION_RE = /\.(?:njk|nunjucks|html?|tmpl|tpl|js|ts|mjs|cjs|jsx|tsx|json|ya?ml|css|scss|sass|less|md|txt)$/iu;
const WHITESPACE_RE = /\s/u;

const isWordChar = (char: string | undefined): boolean => WORD_CHAR_RE.test(char ?? '');

const isPathLike = (word: string): boolean =>
  PATH_SEPARATOR_RE.test(word) || FILE_EXTENSION_RE.test(word);

const findWordStart = (line: string, wordEnd: number): number => {
  let pos = wordEnd - 2;
  while (pos > 0 && isWordChar(line[pos - 1])) {
    pos -= 1;
  }
  return pos;
};

const findWordEnd = (line: string, pos: number): number => {
  let currentPos = pos;
  while (currentPos < line.length && isWordChar(line[currentPos])) {
    currentPos += 1;
  }
  return currentPos;
};

const findNonWordLeft = (line: string, pos: number): number => {
  let searchLeft = pos - 1;
  while (searchLeft >= 0 && !isWordChar(line[searchLeft])) {
    searchLeft -= 1;
  }
  return searchLeft;
};

const findWordBoundaries = (line: string, pos: number, charAtPos: string): { wordStart: number; wordEnd: number } => {
  let wordStart = pos;
  let wordEnd = pos;
  if (isWordChar(charAtPos)) {
    wordEnd = findWordEnd(line, pos);
    wordStart = findWordStart(line, wordEnd);
  }
  return { wordStart, wordEnd };
};

const findSegmentInDotPath = (
  highlightWord: string,
  wordStart: number,
  _wordEnd: number,
  relativePos: number
): { wordStart: number; wordEnd: number; highlightWord: string } | null => {
  const segments = highlightWord.split('.');
  const { found } = segments.reduce<{ found: { wordStart: number; wordEnd: number; highlightWord: string } | null; offset: number }>(
    (acc, segment) => {
      if (acc.found) { return acc; }
      const segmentStart = wordStart + acc.offset;
      const segmentEnd = segmentStart + segment.length;
      const matched = relativePos >= acc.offset && relativePos <= acc.offset + segment.length;
      return {
        found: matched ? { wordStart: segmentStart, wordEnd: segmentEnd, highlightWord: segment } : null,
        offset: acc.offset + segment.length + 1
      };
    },
    { found: null, offset: 0 }
  );
  return found;
};

const resolveHighlightWord = (
  line: string,
  pos: number,
  wordStart: number,
  wordEnd: number
): { wordStart: number; wordEnd: number; highlightWord: string } => {
  const highlightWord = line.slice(wordStart, wordEnd);
  if (highlightWord?.includes('.') && !isPathLike(highlightWord)) {
    const relativePos = pos - wordStart;
    const result = findSegmentInDotPath(highlightWord, wordStart, wordEnd, relativePos);
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

const calculateCaretPosition = (
  line: string,
  displayCol: number
): CaretResult | null => {
  if (displayCol <= 0 || !line) { return null; }

  const rawPos = displayCol - 1;
  const rawCharAtPos = line[rawPos];

  if (!isWordChar(rawCharAtPos) && rawCharAtPos && !WHITESPACE_RE.test(rawCharAtPos)) {
    return {
      wordStart: rawPos,
      wordEnd: rawPos + 1,
      highlightWord: rawCharAtPos,
      carets: '^'
    };
  }

  const searchLeft = !isWordChar(rawCharAtPos) ? findNonWordLeft(line, rawPos) : rawPos;
  const pos = (!isWordChar(rawCharAtPos) && searchLeft >= 0 && isWordChar(line[searchLeft])) ? searchLeft : rawPos;
  const charAtPos = line[pos];

  const { wordStart: initialStart, wordEnd: initialEnd } = findWordBoundaries(line, pos, charAtPos ?? '');
  const { wordStart, wordEnd, highlightWord } = resolveHighlightWord(line, pos, initialStart, initialEnd);
  const carets = buildCarets(highlightWord);

  return { wordStart, wordEnd, highlightWord, carets };
};

export { calculateCaretPosition };
export type { CaretResult };
