import { createLog } from '@nunjucks/error-formatter';
import type { TemplateError } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE } from '@nunjucks/lib';
import type { LexerState } from './types.ts';

// WHY: reaching EOF while scanning a string/comment/template literal must not silently consume
// the rest of the template as content — surface it as a dedicated parse error at the delimiter.
const createUnterminatedLiteralError = (kind: string, origin: LexerState): TemplateError =>
  createLog('error', {
    def: {
      name: 'UNTERMINATED_LITERAL',
      message: () => `Unterminated ${kind} literal`,
      pattern: MATCH_ANY_RE,
    },
    params: {},
    subject: null,
    context: { lineno: origin.lineno, colno: origin.colno, phase: 'parse', lineBase: 'zero' },
  });

export { createUnterminatedLiteralError };
