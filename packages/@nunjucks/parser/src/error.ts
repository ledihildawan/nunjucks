import type { ErrorDefinitionEntry, RawLogData, TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { err, isOk, MATCH_ANY_RE, type Result } from '@nunjucks/lib';
import { find, mapValues } from 'remeda';
import type { ParserContext } from './cursor.ts';
import { peekToken } from './cursor.ts';

const CAUSE_PATTERNS: Array<{ check: (lower: string) => boolean; causes: string[] }> = [
  {
    check: (lower) => lower.includes('expected') && lower.includes('expression'),
    causes: [
      'Missing expression where one is required',
      'Check for empty `{{ }}` or `{% %}` blocks',
    ],
  },
  {
    check: (lower) => lower.includes('expected') && lower.includes('end'),
    causes: [
      '**Unclosed tag** - missing `{% end... %}`',
      'Check that all block tags have matching closing tags',
    ],
  },
  {
    check: (lower) => lower.includes('expected') && lower.includes(','),
    causes: [
      '**Missing comma** between values',
      'Array/object literals require commas between elements',
    ],
  },
  {
    check: (lower) => lower.includes('unknown block'),
    causes: ['**Typo** in block tag name', 'Block tag is not registered or not yet supported'],
  },
  {
    check: (lower) => lower.includes('expected') && lower.includes('in'),
    causes: ['**For loop** missing `in` keyword', 'Use correct syntax: `{% for item in items %}`'],
  },
  {
    check: (lower) => lower.includes('variable name'),
    causes: [
      '**Invalid identifier** used as variable name',
      'Variable names must start with letter/underscore',
    ],
  },
];

const DEFAULT_CAUSES = [
  'Check **template syntax** at the error location',
  'Compare with the **documentation** examples',
];

const inferCauses = (message: string): string[] => {
  const lower = message.toLowerCase();
  return find(CAUSE_PATTERNS, (pattern) => pattern.check(lower))?.causes ?? DEFAULT_CAUSES;
};

const FIX_PATTERNS: Array<{ check: (lower: string) => boolean; fix: string }> = [
  {
    check: (lower) => lower.includes('expected') && lower.includes('expression'),
    fix: '{{ someExpression }}',
  },
  { check: (lower) => lower.includes('unknown block'), fix: '{% if condition %}...{% endif %}' },
  {
    check: (lower) => lower.includes('expected') && lower.includes('in'),
    fix: '{% for item in items %}...{% endfor %}',
  },
  {
    check: (lower) => lower.includes('expected') && lower.includes(','),
    fix: '{{ [1, 2, 3] }} or {{ {a: 1, b: 2} }}',
  },
];

const DEFAULT_FIX = 'Check template syntax around the error location';

const inferFix = (message: string): string => {
  const lower = message.toLowerCase();
  return find(FIX_PATTERNS, (pattern) => pattern.check(lower))?.fix ?? DEFAULT_FIX;
};

/** Sentinel tagging `expected colon after dict key` failures for pattern retries. */
export const EXPECTED_COLON_AFTER_DICT_KEY = 'EXPECTED_COLON_AFTER_DICT_KEY';

/**
 * Parser-internal error channel: a `TemplateError` optionally carrying a `sentinel`
 * tag for control-flow retries higher in the parser. Not part of the public
 * `TemplateError` shape — only `error`/`fail` write it and `readSentinel` reads it.
 */
export type ParserError = TemplateError & { sentinel?: string };

/** Reads the parser-internal sentinel tag; `undefined` on untagged errors. */
export const readSentinel = (candidate: TemplateError): string | undefined =>
  (candidate as ParserError).sentinel;

/**
 * Options for building a parser error: location fields default to the
 * peeked token's position when omitted, and `sentinel` tags the error for
 * control-flow retries higher in the parser.
 */
export interface ParserErrorOptions {
  message: string;
  lineno?: number;
  colno?: number;
  sentinel?: string;
}

/**
 * Builds a catalogued `PARSER_ERROR` for a parse failure, inferring likely
 * causes and a suggested fix from the message text and resolving the
 * location from the peeked token when not supplied.
 */
export const error = (
  parserContext: ParserContext,
  { message, lineno, colno, sentinel }: ParserErrorOptions
): ParserError => {
  const needsResolve = lineno === undefined || colno === undefined;
  const peekedResult = needsResolve ? peekToken(parserContext) : undefined;
  const peeked = peekedResult && isOk(peekedResult) ? peekedResult.value : undefined;
  const resolvedLineno = needsResolve ? (peeked?.lineno ?? 0) : lineno;
  const resolvedColno = needsResolve ? (peeked?.colno ?? 0) : colno;
  const errObj = createLog('error', {
    def: {
      name: 'PARSER_ERROR',
      message: () => message,
      pattern: MATCH_ANY_RE,
      causes: inferCauses(message),
      fixCode: inferFix(message),
      fixComment: 'See the causes above for guidance',
    },
    params: {},
    subject: null,
    context: { lineno: resolvedLineno, colno: resolvedColno, phase: 'parse', lineBase: 'zero' },
  });
  if (sentinel) {
    // WHY: Object.assign's intersection return type carries the sentinel without a cast
    return Object.assign(errObj, { sentinel });
  }
  return errObj;
};

/** Returns `Err` of a catalogued parser error, the Result-envelope form of `error`. */
export const fail = (
  parserContext: ParserContext,
  options: ParserErrorOptions
): Result<never, TemplateError> => err(error(parserContext, options));

interface ErrorAtOptions {
  lineno: number;
  colno: number;
  errorDef: ErrorDefinitionEntry | RawLogData;
  subject?: string;
  extra?: Record<string, unknown>;
}

/**
 * Returns `Err` of an error defined by an existing catalog entry at an
 * exact location, stringifying `extra` params for the formatter.
 */
export const errorAt = ({
  lineno,
  colno,
  errorDef,
  subject,
  extra,
}: ErrorAtOptions): Result<never, TemplateError> => {
  // WHY: `createLog`'s `params` is typed `Record<string, string>` but callers pass `Record<string, unknown>`. Coerce each value via `String()` so the catalog formatter receives a real string (instead of relying on the unsafe `as Record<string, string>` cast that would silently corrupt error output for non-string params).
  const stringParams = mapValues(extra ?? {}, (value) => String(value));
  return err(
    createLog('error', {
      def: errorDef,
      params: stringParams,
      subject: subject ?? null,
      context: { lineno, colno, phase: 'parse', lineBase: 'zero' },
    })
  );
};
