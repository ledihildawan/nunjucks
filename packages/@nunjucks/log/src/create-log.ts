import { isFunction, isString, pipe, pickBy } from 'remeda';
import type { LineBase } from './render/internal/location.ts';
import { normalizeLineBase, formatLocationAnnotation } from './render/internal/location.ts';
import { buildSourceTrace } from './render/internal/source-trace.ts';
import { createFormatterState } from './render/internal/metadata.ts';
import { toAnsi } from './render/to-ansi.ts';
import { toText } from './render/to-text.ts';
import { toHtml } from './render/to-html.ts';
import { toConsoleString } from './render/to-console.ts';

const TEMPLATE_ERROR = Symbol('TemplateError');

export interface ErrorDefinitionEntry {
  name: string;
  message: ((args?: Record<string, string> | string[]) => string) | string;
  pattern: RegExp;
  causes?: string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: 'error' | 'warning' | 'info';
}

const resolveMessage = (message: ErrorDefinitionEntry['message'], params?: Record<string, string>): string => {
  if (isFunction(message)) { return message(params); }
  if (isString(message) && params) { return message.replace(/\{(\w+)\}/gu, (_, k) => params[k] ?? ''); }
  return message;
};

export interface ErrorInfo {
  code?: string | null;
  subject?: string | null;
  phase?: string | null;
  templateName?: string | null;
  renderContext?: Record<string, unknown>;
  lineBase?: LineBase | null;
  dev?: boolean;
}

export interface WarningInfo extends ErrorInfo {
  varName?: string | null;
  undefinedMode?: string;
}

export interface OutputOptions {
  format?: 'html' | 'ansi' | 'text';
  verbosity?: 'simple' | 'medium' | 'full';
  dev?: boolean;
  ide?: string;
  isProduction?: boolean;
  templatePath?: string;
  renderContext?: Record<string, unknown>;
  version?: string;
  timestamp?: string;
  sourceContent?: string;
  sourceStartLine?: number;
  snippet?: string;
  csp?: { nonce?: string };
  jsCaller?: string;
  jsCallerErrorLine?: number;
  isJsCaller?: boolean;
}

export interface TemplateError extends Error {
  name: 'Template render error';
  lineno: number | null;
  colno: number | null;
  code: string | null;
  subject: string | null;
  phase: string | null;
  templateName: string | null;
  templatePath: string | null;
  renderContext?: Record<string, unknown>;
  lineBase?: LineBase | null;
  sourceContent?: string;
  sourceStartLine?: number;
  firstUpdate?: boolean;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
  documentationUrl?: string | null;
  severity?: 'error' | 'warning' | 'info';
  path?: string | null;
  toJSON?: () => Record<string, unknown>;
  outputOptions?: Omit<OutputOptions, 'format'>;
  output: (options?: OutputOptions) => Promise<string>;
  applyLocation?: (path: string | undefined, includeChain?: IncludeChain) => TemplateError;
  _includeChain?: IncludeChain;
  [TEMPLATE_ERROR]?: boolean;
}

export interface TemplateWarning {
  message: string;
  lineno: number | null;
  colno: number | null;
  varName: string | null;
  templateName: string | null;
  undefinedMode: string;
  code: string | null;
  subject: string | null;
  phase: string | null;
  lineBase?: LineBase | null;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
  output: (options?: Omit<OutputOptions, 'format' | 'isProduction'>) => string;
}

export interface ErrorContext {
  lineno?: number | null;
  colno?: number | null;
  phase?: string | null;
  templateName?: string | null;
  templatePath?: string | null;
  lineBase?: LineBase | null;
  sourceContent?: string;
  sourceStartLine?: number;
}

export interface WarningContext extends ErrorContext {
  varName?: string | null;
  undefinedMode?: string | null;
}

interface BaseContext {
  lineno: number | null;
  colno: number | null;
  phase: string | null;
  templateName: string | null;
  lineBase: LineBase | null;
}

interface NormalizedErrorContext extends BaseContext {}

interface NormalizedWarningContext extends BaseContext {
  varName: string | null;
  undefinedMode: string;
}

const normalizeContext = <T extends BaseContext>(
  context: ErrorContext | WarningContext | undefined | null,
  extra: (c: ErrorContext | WarningContext) => Partial<T>
): T => ({
  lineno: context?.lineno ?? null,
  colno: context?.colno ?? null,
  phase: context?.phase ?? null,
  templateName: context?.templateName ?? null,
  lineBase: context?.lineBase ?? null,
  ...extra(context ?? {})
} as T);

const isErrorDefinitionEntry = (data: unknown): data is ErrorDefinitionEntry => {
  if (typeof data !== 'object' || data === null || !('message' in data)) { return false; }
  const { message } = data as { message: unknown };
  return (typeof message === 'function' || typeof message === 'string') && !('lineno' in data);
};

interface LegacyLogData {
  message: string;
  lineno?: number | null;
  colno?: number | null;
  info?: ErrorInfo | WarningInfo;
}

type LogType = 'error' | 'warning';

const createBaseMetadata = (message: string, data: LegacyLogData, info: ErrorInfo | WarningInfo, type: LogType) => {
  const base = {
    message,
    lineno: data.lineno ?? null,
    colno: data.colno ?? null,
    code: info.code ?? null,
    subject: info.subject ?? null,
    phase: info.phase ?? null,
    templateName: info.templateName ?? null,
    lineBase: info.lineBase ?? null,
  };
  if (type === 'warning') {
    const warningInfo = info as WarningInfo;
    return {
      ...base,
      varName: warningInfo.varName ?? null,
      undefinedMode: warningInfo.undefinedMode ?? 'chainable'
    };
  }
  return base;
};

// The six location/identity fields every presenter needs, read off whichever
// log object owns them. Errors additionally carry a render context; warnings
// never do.
const toFormatterMetadata = (log: TemplateError | TemplateWarning, renderContext?: Record<string, unknown>) => ({
  lineno: log.lineno,
  colno: log.colno,
  phase: log.phase,
  templateName: log.templateName,
  code: log.code,
  subject: log.subject,
  renderContext,
  lineBase: normalizeLineBase(log.lineBase)
});

const buildErrorOutput = (err: TemplateError) => async (options: OutputOptions = {}): Promise<string> => {
  const verbosity = options.verbosity ?? 'full';
  // Compute the source trace ONCE and share it with every presenter, so the
  // line-math / windowing / caret logic lives in exactly one place. Skipped
  // for 'simple' verbosity, which shows only the message and never a trace.
  const sourceTrace = verbosity === 'simple'
    ? null
    : await buildSourceTrace({
        sourceContent: err.sourceContent ?? null,
        templatePath: options.templatePath ?? err.templatePath ?? err.templateName ?? null,
        lineno: err.lineno,
        colno: err.colno,
        lineBase: normalizeLineBase(options.isJsCaller ? 'one' : err.lineBase),
        sourceStartLine: err.sourceStartLine ?? 1
      });

  const opts = createFormatterState({
    metadata: toFormatterMetadata(err, err.renderContext),
    options: { ...options, sourceTrace }
  });

  if (options.format === 'ansi') { return await toAnsi(err, opts); }
  if (options.format === 'text') { return toText(err, opts); }
  return await toHtml(err, opts);
};

const buildWarningOutput = (warn: TemplateWarning) => (options: Omit<OutputOptions, 'format' | 'isProduction'> = {}): string =>
  toConsoleString(warn, createFormatterState({ metadata: toFormatterMetadata(warn), options }));

const buildErrorJson = (err: TemplateError) => (): Record<string, unknown> => ({
  name: err.name,
  code: err.code,
  subject: err.subject,
  message: err.message,
  phase: err.phase,
  templateName: err.templateName,
  templatePath: err.templatePath,
  sourceStartLine: err.sourceStartLine,
  lineno: err.lineno,
  colno: err.colno,
  lineBase: err.lineBase,
  causes: err.causes,
  fixCode: err.fixCode,
  fixComment: err.fixComment,
  severity: err.severity,
  stack: err.stack
});

export function createLog(
  type: string,
  errorDefOrData: ErrorDefinitionEntry | LegacyLogData,
  params?: Record<string, string>,
  subject?: string | null,
  context?: ErrorContext | null
): TemplateError | TemplateWarning {
  if (!isErrorDefinitionEntry(errorDefOrData)) {
    if (type !== 'error' && type !== 'warning') { throw new Error(`Unknown log type: ${type}`); }
    const info = (errorDefOrData.info ?? {}) as WarningInfo;
    const base = createBaseMetadata(errorDefOrData.message, errorDefOrData, info, type);

    if (type === 'error') {
      const err = new Error(base.message) as TemplateError;
      const props = { name: 'Template render error', code: base.code, subject: base.subject, lineno: base.lineno, colno: base.colno, phase: base.phase, templateName: base.templateName, lineBase: base.lineBase, templatePath: base.templateName, [TEMPLATE_ERROR]: true as const };
      Object.assign(err, props);
      err.output = buildErrorOutput(err);
      return err;
    }

    const warn = {
      message: base.message,
      lineno: base.lineno,
      colno: base.colno,
      varName: info.varName ?? null,
      templateName: base.templateName,
      undefinedMode: info.undefinedMode ?? 'chainable',
      code: base.code,
      subject: base.subject,
      phase: base.phase,
      lineBase: base.lineBase
    } as TemplateWarning;
    warn.output = buildWarningOutput(warn);
    return warn;
  }

  const errorDef = errorDefOrData;
  if (type !== 'error' && type !== 'warning') { throw new Error(`Unknown log type: ${type}`); }
  const paramsValue = params as Record<string, string> | undefined;
  let normalized: NormalizedErrorContext | NormalizedWarningContext;
  if (type === 'error') {
    normalized = normalizeContext<NormalizedErrorContext>(context as ErrorContext, () => ({}));
  } else {
    normalized = normalizeContext<NormalizedWarningContext>(context as WarningContext, (c) => ({ varName: (c as WarningContext).varName ?? null, undefinedMode: (c as WarningContext).undefinedMode ?? 'chainable' }));
  }

  const extraKeys = ['lineno', 'colno', 'phase', 'templateName', 'lineBase', 'varName', 'undefinedMode'];
  let extra: Record<string, unknown> | undefined;
  if (context) {
    extra = pickBy(context, (_, k) => !extraKeys.includes(k));
  } else {
    extra = undefined;
  }

  if (type === 'error') {
    const err = new Error(resolveMessage(errorDef.message, paramsValue)) as TemplateError;
    Object.assign(err, { name: 'Template render error', code: errorDef.name, subject: subject ?? null, ...normalized, [TEMPLATE_ERROR]: true });
    if (extra?.sourceContent) { err.sourceContent = extra.sourceContent as string; }
    if (extra && Number.isInteger(extra.sourceStartLine)) { err.sourceStartLine = extra.sourceStartLine as number; }
    err.templatePath = normalized.templateName;
    if (errorDef.causes && errorDef.causes.length > 0) { err.causes = errorDef.causes; }
    if (errorDef.fixCode) { err.fixCode = errorDef.fixCode; }
    if (errorDef.fixComment) { err.fixComment = errorDef.fixComment; }
    if (errorDef.documentationUrl) { err.documentationUrl = errorDef.documentationUrl; }
    if (errorDef.severity) { err.severity = errorDef.severity; }
    err.toJSON = buildErrorJson(err);
    err.output = buildErrorOutput(err);
    return err;
  }

  const normalizedWarning = normalized as NormalizedWarningContext;
  const warn = {
    message: resolveMessage(errorDef.message, paramsValue),
    code: errorDef.name,
    subject: subject ?? null,
    ...normalizedWarning
  } as TemplateWarning;
  if (errorDef.causes && errorDef.causes.length > 0) { warn.causes = errorDef.causes; }
  if (errorDef.fixCode) { warn.fixCode = errorDef.fixCode; }
  if (errorDef.fixComment) { warn.fixComment = errorDef.fixComment; }
  warn.output = buildWarningOutput(warn);
  return warn;
}

export function isTemplateError(obj: unknown): obj is TemplateError {
  // The cast must admit null/undefined: this guard is called with arbitrary
  // values, and the optional chain is what stops it throwing on them.
  return (obj as TemplateError | null | undefined)?.[TEMPLATE_ERROR] === true;
}

/** Where an included/extended template was pulled in from. Exported: it is a
 * field type of `prettifyError`'s options and of `TemplateError`. */
export interface IncludeChain {
  parentTmpl: string;
  parentLineno: number;
  parentColno?: number | null;
}

interface PrettifyErrorOptions {
  path?: string;
  withInternals?: boolean;
  err: Error | TemplateError;
  includeChain?: IncludeChain;
}

const asTemplateError = (err: Error | TemplateError): TemplateError => {
  if (isTemplateError(err)) { return err; }
  const e = err as Partial<TemplateError>;
  return createLog('error', { name: e.code ?? 'ERROR', message: err.message }, undefined, e.subject ?? null, {
    lineno: e.lineno ?? null,
    colno: e.colno ?? null,
    phase: e.phase ?? 'render',
    templateName: e.templateName ?? null,
    lineBase: e.lineBase ?? 'zero'
  }) as TemplateError;
};

const withLocation = ({ path, includeChain }: { path?: string; includeChain?: IncludeChain }) => (err: TemplateError): TemplateError => {
  err.applyLocation = (locationPath: string | undefined, chain?: IncludeChain): TemplateError => {
    let msg = `(${locationPath || 'unknown path'})`;
    if (err.firstUpdate) {
      const annotation = formatLocationAnnotation(err.lineno, err.colno, err.lineBase);
      if (annotation) { msg += ` ${annotation}`; }
    }
    if (chain && err.firstUpdate) {
      let parentColnoPart: string;
      if (chain.parentColno) {
        parentColnoPart = `:${chain.parentColno}`;
      } else {
        parentColnoPart = '';
      }
      msg += `\n   (included from ${chain.parentTmpl}:${chain.parentLineno}${parentColnoPart})`;
    }
    msg += '\n ';
    if (err.firstUpdate) {
      msg += ' ';
    }
    err.message = msg + (err.message || '');
    err.firstUpdate = false;
    return err;
  };
  err.templateName = err.templateName ?? (path ?? null);
  if (includeChain) {
    err._includeChain = includeChain;
  }
  return err;
};

const stripInternals = (path?: string) => (err: TemplateError): TemplateError => {
  const clean = new Error(err.message, { cause: err }) as TemplateError;
  clean.name = err.name;
  clean.lineno = err.lineno;
  clean.colno = err.colno;
  clean.path = err.path ?? (path ?? null);
  clean.templateName = err.templateName ?? (path ?? null);
  clean.code = err.code;
  clean.subject = err.subject;
  clean.phase = err.phase;
  clean.lineBase = err.lineBase ?? 'zero';
  if (err._includeChain) {
    clean._includeChain = err._includeChain;
  }
  return clean;
};

export function prettifyError(options: PrettifyErrorOptions): TemplateError {
  const { path, withInternals, err, includeChain } = options;
  if (withInternals) {
    return pipe(err, asTemplateError, withLocation({ path, includeChain })) as TemplateError;
  }
  return pipe(err, asTemplateError, withLocation({ path, includeChain }), stripInternals(path)) as TemplateError;
}
