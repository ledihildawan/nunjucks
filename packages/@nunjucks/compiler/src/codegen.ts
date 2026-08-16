import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import { last, pipe, split } from 'remeda';
import type { Emitter } from './index.ts';

interface FailOptions {
  compiler: { templateName: string | null };
  msg: string;
  lineno?: number;
  colno?: number;
  errorName?: string;
}

export const fail = ({
  compiler,
  msg,
  lineno,
  colno,
  errorName = 'WALK_UNKNOWN_TYPE',
}: FailOptions): never => {
  const lastPart = pipe(msg, split(':'), last());
  const subject = (lastPart ?? 'compile').trim();
  const errorDef =
    ERROR_DEFINITIONS[errorName as keyof typeof ERROR_DEFINITIONS] ??
    ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE;

  throw createLog('error', {
    def: errorDef,
    params: { type: subject, detail: msg },
    subject,
    context: {
      lineno,
      colno,
      phase: 'compile',
      templateName: compiler.templateName,
      lineBase: 'zero',
    },
  });
};

// WHY: §10 boundary validation — this check is the PRIMARY code-injection defense at
// the codegen boundary, NOT defense-in-depth: the lexer does not restrict symbol
// characters (quotes, semicolons, and backslashes are absent from DELIM_CHARS, so
// tokenizeSymbol accepts runs like a";evil), and a template-derived name flowing into
// a generated JS identifier (b_<name>) or string literal ("${name}") must be a safe JS
// identifier so it cannot break out of its emit context. Removing this check would
// reopen direct injection into the new Function source. `$` and `_` are legitimate JS
// identifier chars and are allowed; anything else fails closed with a clear compile error.
const SAFE_IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/u;

interface AssertIdentifierOptions {
  compiler: { templateName: string | null };
  lineno?: number | null;
  colno?: number | null;
}

export const assertSafeIdentifier = (
  name: string,
  { compiler, lineno, colno }: AssertIdentifierOptions
): void => {
  if (SAFE_IDENTIFIER_RE.test(name)) {
    return;
  }
  throw createLog('error', {
    def: ERROR_DEFINITIONS.INVALID_IDENTIFIER,
    params: { name },
    subject: name,
    context: {
      lineno: lineno ?? undefined,
      colno: colno ?? undefined,
      phase: 'compile',
      templateName: compiler.templateName,
      lineBase: 'zero',
    },
  });
};

export const nextCompilerId = (compiler: { lastId: number }): string => {
  compiler.lastId += 1;
  return `t_${compiler.lastId}`;
};

export const emitLocationGuard = (
  compiler: Pick<Emitter, 'emit'>,
  lineno: number,
  colno: number
): void => {
  compiler.emit(`(lineno = ${lineno}, colno = ${colno}, `);
};

export const emitLineLocation = (
  compiler: Pick<Emitter, 'emitLine'>,
  lineno: number,
  colno: number
): void => {
  compiler.emitLine(`lineno = ${lineno}; colno = ${colno};`);
};

export const pushBuffer = (
  compiler: Pick<Emitter, 'buffer' | 'bufferStack' | 'emit' | 'getCode'> & { lastId: number }
): string => {
  const id = nextCompilerId(compiler);
  compiler.bufferStack.push(compiler.buffer);
  compiler.buffer = id;
  compiler.emit(`let ${id} = "";`);
  return id;
};

// WHY: Option B streaming — the root template renders as an async generator (`buffer === null`) and emits `yield chunk`; blocks/capture/slots still accumulate into a named string buffer and emit `buffer += chunk`. This picks the correct append target so every output emit-site stays uniform regardless of whether it currently sits in the streaming root or a string-returning scope.
export const appendTarget = (compiler: Pick<Emitter, 'buffer'>): string =>
  compiler.buffer === null ? 'yield ' : `${compiler.buffer} += `;

export const getTemplateName = (compiler: { templateName: string | null }): string => {
  if (compiler.templateName === null || compiler.templateName === undefined) {
    return 'undefined';
  }
  return JSON.stringify(compiler.templateName);
};
