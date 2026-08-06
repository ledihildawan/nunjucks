// Template source-code security scanning. Shared by the runtime and validators
// packages so the dangerous-code patterns and line/column math live in one
// place. (Context-value scanning — findDangerousValues — is NOT consolidated
// here: the runtime and validators implementations have meaningfully diverged.)

export interface DangerousCodeViolation {
  message: string;
  pattern: string;
  line: number;
  col: number;
  name: string | null;
}

// Hoisted so each pattern is compiled once rather than on every scan.
const DANGEROUS_PATTERNS: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  { pattern: /\beval\s*\(/u, message: 'eval() is not allowed' },
  { pattern: /\bFunction\s*\(/u, message: 'Function constructor is not allowed' },
  { pattern: /\brequire\s*\(/u, message: 'require() is not allowed' },
  { pattern: /\bimport\s+\(/u, message: 'dynamic import() is not allowed' },
];

const IDENTIFIER_PATTERN = /[a-zA-Z_$][\w$]*/u;

const getLineColFromIndex = (content: string, index: number): { line: number; col: number } => {
  const beforeMatch = content.slice(0, index);
  const lines = beforeMatch.split('\n');
  return { line: lines.length, col: lines.at(-1)?.length ?? 0 };
};

const scanTemplateForDangerousCode = (templateContent: string): DangerousCodeViolation[] =>
  DANGEROUS_PATTERNS.flatMap(({ pattern, message }) => {
    const regex = new RegExp(pattern.source, 'gu');
    const matches = [...templateContent.matchAll(regex)];
    return matches.map(match => {
      const { line, col } = getLineColFromIndex(templateContent, match.index);
      const nameMatch = match[0].match(IDENTIFIER_PATTERN);
      const [name = null] = nameMatch ?? [];
      return { message, pattern: pattern.source, line, col, name };
    });
  });

export { scanTemplateForDangerousCode };
