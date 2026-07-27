import { createLog } from '@nunjucks/log';
import { peekToken } from "./cursor.ts";
import type { ParserContext } from "./cursor.ts";

/** Placeholder pattern for synthesised error definitions, which are never matched against. */
const MATCH_ANY_RE = /./;

const CAUSE_PATTERNS: Array<{ check: (lower: string) => boolean; causes: string[] }> = [
  { check: lower => lower.includes('expected') && lower.includes('expression'), causes: ['Missing expression where one is required', 'Check for empty `{{ }}` or `{% %}` blocks'] },
  { check: lower => lower.includes('expected') && lower.includes('end'), causes: ['**Unclosed tag** - missing `{% end... %}`', 'Check that all block tags have matching closing tags'] },
  { check: lower => lower.includes('expected') && lower.includes(','), causes: ['**Missing comma** between values', 'Array/object literals require commas between elements'] },
  { check: lower => lower.includes('unknown block'), causes: ['**Typo** in block tag name', 'Block tag is not registered or not yet supported'] },
  { check: lower => lower.includes('expected') && lower.includes('in'), causes: ['**For loop** missing `in` keyword', 'Use correct syntax: `{% for item in items %}`'] },
  { check: lower => lower.includes('variable name'), causes: ['**Invalid identifier** used as variable name', 'Variable names must start with letter/underscore'] },
];

const DEFAULT_CAUSES = ['Check **template syntax** at the error location', 'Compare with the **documentation** examples'];

const inferCauses = (msg: string): string[] => {
  const lower = msg.toLowerCase();
  for (const pattern of CAUSE_PATTERNS) {
    if (pattern.check(lower)) {
      return pattern.causes;
    }
  }
  return DEFAULT_CAUSES;
};

const FIX_PATTERNS: Array<{ check: (lower: string) => boolean; fix: string }> = [
  { check: lower => lower.includes('expected') && lower.includes('expression'), fix: '{{ someExpression }}' },
  { check: lower => lower.includes('unknown block'), fix: '{% if condition %}...{% endif %}' },
  { check: lower => lower.includes('expected') && lower.includes('in'), fix: '{% for item in items %}...{% endfor %}' },
  { check: lower => lower.includes('expected') && lower.includes(','), fix: '{{ [1, 2, 3] }} or {{ {a: 1, b: 2} }}' },
];

const DEFAULT_FIX = 'Check template syntax around the error location';

const inferFix = (msg: string): string => {
  const lower = msg.toLowerCase();
  for (const pattern of FIX_PATTERNS) {
    if (pattern.check(lower)) {
      return pattern.fix;
    }
  }
  return DEFAULT_FIX;
};

export const EXPECTED_COLON_AFTER_DICT_KEY = 'EXPECTED_COLON_AFTER_DICT_KEY';

export const error = (ctx: ParserContext, msg: string, lineno?: number, colno?: number, sentinel?: string) => {
  let resolvedLineno = lineno;
  let resolvedColno = colno;
  if (resolvedLineno === undefined || resolvedColno === undefined) {
    const tok = peekToken(ctx) || {};
    resolvedLineno = tok.lineno ?? ctx.tokens?.lineno;
    resolvedColno = tok.colno ?? ctx.tokens?.colno;
  }
  const err = createLog('error', {
    name: 'PARSER_ERROR',
    message: () => msg,
    pattern: MATCH_ANY_RE,
    causes: inferCauses(msg),
    fixCode: inferFix(msg),
    fixComment: 'See the causes above for guidance',
    suggestion: 'Use the syntax highlighting in your IDE to spot issues quickly'
  } as Parameters<typeof createLog>[1], {}, null, { lineno: resolvedLineno, colno: resolvedColno, phase: 'parse', lineBase: 'zero' });
  if (sentinel) {
    Object.assign(err, { sentinel });
  }
  return err;
};

export const fail = (ctx: ParserContext, msg: string, lineno?: number, colno?: number, sentinel?: string): never => {
  throw error(ctx, msg, lineno, colno, sentinel);
};
