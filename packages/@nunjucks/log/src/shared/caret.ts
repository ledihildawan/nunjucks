export interface CaretResult {
  wordStart: number;
  wordEnd: number;
  highlightWord: string;
  carets: string;
}

export function calculateCaretPosition(
  line: string,
  displayCol: number
): CaretResult | null {
  if (displayCol <= 0 || !line) return null;

  const isWordChar = (char: string | undefined): boolean => /[\w./\\-]/.test(char ?? '');
  const isPathLike = (word: string): boolean =>
    /[\\/-]/.test(word) ||
    /\.(?:njk|nunjucks|html?|tmpl|tpl|js|ts|mjs|cjs|jsx|tsx|json|ya?ml|css|scss|sass|less|md|txt)$/i.test(word);

  let pos = displayCol - 1;
  let charAtPos = line[pos];

  if (!isWordChar(charAtPos)) {
    if (charAtPos && !/\s/.test(charAtPos)) {
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

  const carets = highlightWord ? '^'.repeat(highlightWord.length) : '^'.repeat(3);

  return { wordStart, wordEnd, highlightWord, carets };
}
