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

const getLineColFromIndex = (content: string, index: number): { line: number; col: number } => {
  const beforeMatch = content.slice(0, index);
  const lines = beforeMatch.split('\n');
  return { line: lines.length, col: lines.at(-1)?.length ?? 0 };
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

const removeStringLiteralsAndComments = (template: string): string => {
  return template.replace(STRING_LITERAL_RE, '""').replace(HTML_COMMENT_RE, '');
};

/**
 * Scans raw template source for code-execution calls (`eval`, `Function`,
 * `require`, dynamic `import`) and returns every match with position info.
 * Regex-based and therefore heuristic — it runs before compilation, not on
 * the parsed AST. String literals and HTML comments are stripped before
 * scanning to avoid false positives from content inside strings.
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
