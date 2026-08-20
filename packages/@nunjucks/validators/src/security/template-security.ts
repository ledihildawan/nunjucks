/**
 * One regex hit in a template scan: the `pattern` source, human-readable
 * `message`, 1-based `line`/`col`, and the matched identifier if any.
 */
export interface DangerousCodeViolation {
  message: string;
  pattern: string;
  line: number;
  col: number;
  name: string | null;
}

const DANGEROUS_PATTERNS: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  { pattern: /\beval\s*\(/u, message: 'eval() is not allowed' },
  { pattern: /\bFunction\s*\(/u, message: 'Function constructor is not allowed' },
  { pattern: /\brequire\s*\(/u, message: 'require() is not allowed' },
  { pattern: /\bimport\s+\(/u, message: 'dynamic import() is not allowed' },
];

const STRING_LITERAL_RE = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/gu;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

const IDENTIFIER_PATTERN = /[a-zA-Z_$][\w$]*/u;

// WHY: line/col are documented as 1-based — `slice(0, index).split('\n')` yields a
// 0-based column (chars before the match on its line), so shift up by one, matching
// the engine's `'zero'` lineBase → display convention (toDisplayLocation).
const getLineColFromIndex = (content: string, index: number): { line: number; col: number } => {
  const beforeMatch = content.slice(0, index);
  const lines = beforeMatch.split('\n');
  return { line: lines.length, col: (lines.at(-1)?.length ?? 0) + 1 };
};

interface ViolationInput {
  match: RegExpMatchArray;
  pattern: RegExp;
  message: string;
  source: string;
}

const toViolation = ({
  match,
  pattern,
  message,
  source,
}: ViolationInput): DangerousCodeViolation => {
  const { line, col } = getLineColFromIndex(source, match.index ?? 0);
  const nameMatch = match[0].match(IDENTIFIER_PATTERN);
  const [name = null] = nameMatch ?? [];
  return { message, pattern: pattern.source, line, col, name };
};

// WHY: length-preserving masking — every scrubbed character (including newlines
// inside literals/comments) becomes a space, so match indices in the scrubbed text
// map 1:1 onto the ORIGINAL template. Replacing with shorter strings ('""'/'')
// used to shift every following violation left by the scrubbed length.
const maskWithSpaces = (match: string): string => ' '.repeat(match.length);

const removeStringLiteralsAndComments = (template: string): string =>
  template.replace(STRING_LITERAL_RE, maskWithSpaces).replace(HTML_COMMENT_RE, maskWithSpaces);

/**
 * Scans raw template source for code-execution calls (`eval`, `Function`,
 * `require`, dynamic `import`) and returns every match with 1-based position info
 * relative to the ORIGINAL template. Regex-based and therefore heuristic — it runs
 * before compilation, not on the parsed AST. String literals and HTML comments are
 * masked with same-length spaces before scanning to avoid false positives from
 * content inside strings while keeping scrubbed indices 1:1 with the source.
 */
const scanTemplateForDangerousCode = (templateContent: string): DangerousCodeViolation[] => {
  const scrubbed = removeStringLiteralsAndComments(templateContent);
  return DANGEROUS_PATTERNS.flatMap(({ pattern, message }) => {
    const regex = new RegExp(pattern.source, 'gu');
    const matches = [...scrubbed.matchAll(regex)];
    return matches.map((match) =>
      toViolation({ match, pattern, message, source: templateContent })
    );
  });
};

export { scanTemplateForDangerousCode };
