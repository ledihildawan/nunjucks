/** Width of the caret run when no word could be identified to underline. */
const FALLBACK_CARET_WIDTH = 3;

export interface CaretResult {
  wordStart: number;
  wordEnd: number;
  highlightWord: string;
  carets: string;
}

// Hoisted so each pattern is compiled once rather than on every caret render.
const WORD_CHAR_RE = /[\w./\\-]/u;
const PATH_SEPARATOR_RE = /[\\/-]/u;
const FILE_EXTENSION_RE = /\.(?:njk|nunjucks|html?|tmpl|tpl|js|ts|mjs|cjs|jsx|tsx|json|ya?ml|css|scss|sass|less|md|txt)$/iu;
const WHITESPACE_RE = /\s/u;

const isWordChar = (char: string | undefined): boolean => WORD_CHAR_RE.test(char ?? '');

const isPathLike = (word: string): boolean =>
  PATH_SEPARATOR_RE.test(word) || FILE_EXTENSION_RE.test(word);

export function calculateCaretPosition(
  line: string,
  displayCol: number
): CaretResult | null {
  if (displayCol <= 0 || !line) { return null; }

  let pos = displayCol - 1;
  let charAtPos = line[pos];

  if (!isWordChar(charAtPos)) {
    if (charAtPos && !WHITESPACE_RE.test(charAtPos)) {
      return {
        wordStart: pos,
        wordEnd: pos + 1,
        highlightWord: charAtPos,
        carets: '^'
      };
    }

    let searchLeft = pos - 1;
    while (searchLeft >= 0 && !isWordChar(line[searchLeft])) {
      searchLeft--;
    }
    if (searchLeft >= 0 && isWordChar(line[searchLeft])) {
      pos = searchLeft;
      charAtPos = line[pos];
    }
  }

  let wordStart = pos;
  let wordEnd = pos;
  if (isWordChar(charAtPos)) {
    wordEnd = pos;
    while (wordEnd < line.length && isWordChar(line[wordEnd])) {
      wordEnd++;
    }
    wordStart = wordEnd - 1;
    while (wordStart > 0 && isWordChar(line[wordStart - 1])) {
      wordStart--;
    }
  }

  let highlightWord = line.slice(wordStart, wordEnd);
  if (highlightWord?.includes('.') && !isPathLike(highlightWord)) {
    const relativePos = pos - wordStart;
    let segmentStart = wordStart;
    let segmentEnd = wordStart;

    for (const segment of highlightWord.split('.')) {
      segmentEnd = segmentStart + segment.length;
      if (relativePos >= segmentStart - wordStart && relativePos <= segmentEnd - wordStart) {
        wordStart = segmentStart;
        wordEnd = segmentEnd;
        highlightWord = segment;
        break;
      }
      segmentStart = segmentEnd + 1;
    }
  }

  let carets: string;
  if (highlightWord) {
    carets = '^'.repeat(highlightWord.length);
  } else {
    carets = '^'.repeat(FALLBACK_CARET_WIDTH);
  }

  return { wordStart, wordEnd, highlightWord, carets };
}
