import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import { SAFE_IDENTIFIER_RE } from '@nunjucks/lib';
import { last, pipe, split } from 'remeda';
import type { Emitter } from './create-compiler.ts';

/**
 * Fields shared by every compiler `fail` call — the human message plus optional
 * zero-based location and a catalog `errorName`.
 */
export interface FailFields {
  message: string;
  lineno?: number;
  colno?: number;
  errorName?: keyof typeof ERROR_DEFINITIONS;
}

interface FailOptions extends FailFields {
  compiler: { templateName: string | null };
}

/**
 * Throws the catalogued compile-phase error for `errorName` (defaulting to
 * `WALK_UNKNOWN_TYPE`), deriving the error subject from the last `:`-separated
 * part of `message`.
 */
export const fail = ({
  compiler,
  message,
  lineno,
  colno,
  errorName = 'WALK_UNKNOWN_TYPE',
}: FailOptions): never => {
  const lastPart = pipe(message, split(':'), last());
  const subject = (lastPart ?? 'compile').trim();
  // WHY: bounded lookup — hasOwn guards the catalog probe against malformed runtime
  // payloads so an unregistered name falls back to WALK_UNKNOWN_TYPE instead of
  // surfacing `undefined` as a definition (mirrors the error-catalog lookup contract).
  const errorDef =
    errorName !== undefined && Object.hasOwn(ERROR_DEFINITIONS, errorName)
      ? ERROR_DEFINITIONS[errorName]
      : ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE;

  throw createLog('error', {
    def: errorDef,
    params: { type: subject, detail: message },
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
// The regex itself is the parser-shared SSOT imported from @nunjucks/lib so the two ends
// of the pipeline cannot drift apart on what counts as emittable.
interface AssertIdentifierOptions {
  compiler: { templateName: string | null };
  lineno?: number | null;
  colno?: number | null;
}

/** Asserts `name` is a safe JS identifier, throwing a catalogued error otherwise. */
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

/** Allocates the next unique `t_N` compiler identifier. */
export const nextCompilerId = (compiler: { lastId: number }): string => {
  compiler.lastId += 1;
  return `t_${compiler.lastId}`;
};

/** Emits the `(lineno = N, colno = N, ` prefix that opens a location-guarded expression. */
export const emitLocationGuard = (
  compiler: Pick<Emitter, 'emit'>,
  lineno: number,
  colno: number
): void => {
  compiler.emit(`(lineno = ${lineno}, colno = ${colno}, `);
};

/** Emits a standalone `lineno = N; colno = N;` statement line. */
export const emitLineLocation = (
  compiler: Pick<Emitter, 'emitLine'>,
  lineno: number,
  colno: number
): void => {
  compiler.emitLine(`lineno = ${lineno}; colno = ${colno};`);
};

/**
 * Pushes the current buffer onto `bufferStack`, emits `let t_N = "";`, and
 * returns the new buffer id — every push must pair with a `popBuffer`.
 */
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

/** Serializes `templateName` into a JS string literal, or `undefined` when unset. */
export const getTemplateName = (compiler: { templateName: string | null | undefined }): string => {
  if (compiler.templateName === null || compiler.templateName === undefined) {
    return 'undefined';
  }
  return JSON.stringify(compiler.templateName);
};
