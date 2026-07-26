import { createLog } from '@nunjucks/log';
import { peekToken } from "./cursor.ts";
import type { ParserContext } from "./cursor.ts";

const inferCauses = (msg: string): string[] => {
  const lower = msg.toLowerCase();
  const causes: string[] = [];

  if (lower.includes('expected') && lower.includes('expression')) {
    causes.push('Missing expression where one is required');
    causes.push('Check for empty `{{ }}` or `{% %}` blocks');
  } else if (lower.includes('expected') && lower.includes('end')) {
    causes.push('**Unclosed tag** - missing `{% end... %}`');
    causes.push('Check that all block tags have matching closing tags');
  } else if (lower.includes('expected') && lower.includes(',')) {
    causes.push('**Missing comma** between values');
    causes.push('Array/object literals require commas between elements');
  } else if (lower.includes('unknown block')) {
    causes.push('**Typo** in block tag name');
    causes.push('Block tag is not registered or not yet supported');
  } else if (lower.includes('expected') && lower.includes('in')) {
    causes.push('**For loop** missing `in` keyword');
    causes.push('Use correct syntax: `{% for item in items %}`');
  } else if (lower.includes('variable name')) {
    causes.push('**Invalid identifier** used as variable name');
    causes.push('Variable names must start with letter/underscore');
  } else {
    causes.push('Check **template syntax** at the error location');
    causes.push('Compare with the **documentation** examples');
  }

  return causes;
};

const inferFix = (msg: string): string => {
  const lower = msg.toLowerCase();

  if (lower.includes('expected') && lower.includes('expression')) {
    return '{{ someExpression }}';
  }
  if (lower.includes('unknown block')) {
    return '{% if condition %}...{% endif %}';
  }
  if (lower.includes('expected') && lower.includes('in')) {
    return '{% for item in items %}...{% endfor %}';
  }
  if (lower.includes('expected') && lower.includes(',')) {
    return '{{ [1, 2, 3] }} or {{ {a: 1, b: 2} }}';
  }
  return 'Check template syntax around the error location';
};

export const EXPECTED_COLON_AFTER_DICT_KEY = 'EXPECTED_COLON_AFTER_DICT_KEY';

export const error = (ctx: ParserContext, msg: string, lineno?: number, colno?: number, sentinel?: string) => {
  if (lineno === undefined || colno === undefined) {
    const tok = peekToken(ctx) || {};
    lineno = tok.lineno ?? ctx.tokens?.lineno;
    colno = tok.colno ?? ctx.tokens?.colno;
  }
  const err = createLog('error', {
    name: 'PARSER_ERROR',
    message: () => msg,
    pattern: /./,
    causes: inferCauses(msg),
    fixCode: inferFix(msg),
    fixComment: 'See the causes above for guidance',
    suggestion: 'Use the syntax highlighting in your IDE to spot issues quickly'
  } as Parameters<typeof createLog>[1], {}, null, { lineno, colno, phase: 'parse', lineBase: 'zero' });
  if (sentinel) {
    Object.assign(err, { sentinel });
  }
  return err;
};

export const fail = (ctx: ParserContext, msg: string, lineno?: number, colno?: number, sentinel?: string): never => {
  throw error(ctx, msg, lineno, colno, sentinel);
};
