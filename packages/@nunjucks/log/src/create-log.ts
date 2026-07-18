import { toHtml } from './error/to-html.ts';
import type { CSS, PRODUCTION_BODY, TOGGLE_SCRIPT } from './error/to-html.ts';
import { toAnsi } from './error/to-ansi.ts';
import { toText } from './error/to-text.ts';
import { toConsoleString } from './error/to-console.ts';
import type { LineBase } from './error/location.ts';
import { createFormatterState } from './error/metadata.ts';

export interface ErrorDefinitionEntry {
  name: string;
  message: (args?: Record<string, string> | string[]) => string;
  pattern: RegExp;
}

export interface ErrorInfo {
  code?: string | null;
  subject?: string | null;
  phase?: string | null;
  templateName?: string | null;
  renderContext?: Record<string, unknown>;
  lineBase?: LineBase | null;
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
  renderContext?: Record<string, unknown>;
  lineBase?: LineBase | null;
  outputOptions?: Omit<OutputOptions, 'format'>;
  output: (options?: OutputOptions) => {
    html: string;
    ansi: string;
    text: string;
  } | string;
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
  output: (options?: Omit<OutputOptions, 'format' | 'isProduction'>) => string;
}

export interface ErrorContext {
  lineno?: number | null;
  colno?: number | null;
  phase?: string | null;
  templateName?: string | null;
  templatePath?: string | null;
  lineBase?: LineBase | null;
}

export interface WarningContext extends ErrorContext {
  varName?: string | null;
  undefinedMode?: string | null;
}

interface NormalizedErrorContext {
  lineno: number | null;
  colno: number | null;
  phase: string | null;
  templateName: string | null;
  lineBase: LineBase | null;
}

interface NormalizedWarningContext extends NormalizedErrorContext {
  varName: string | null;
  undefinedMode: string;
}

const normalizeErrorContext = (context?: ErrorContext | null): NormalizedErrorContext => ({
  lineno: context?.lineno ?? null,
  colno: context?.colno ?? null,
  phase: context?.phase ?? null,
  templateName: context?.templateName ?? null,
  lineBase: context?.lineBase ?? null,
});

const normalizeWarningContext = (context?: WarningContext | null): NormalizedWarningContext => ({
  ...normalizeErrorContext(context),
  varName: context?.varName ?? null,
  undefinedMode: context?.undefinedMode ?? 'chainable',
});

const isErrorDefinitionEntry = (data: any): data is ErrorDefinitionEntry =>
  typeof data === 'object' &&
  data !== null &&
  'message' in data &&
  typeof data.message === 'function' &&
  !('lineno' in data);

export function createLog(
  type: 'error',
  errorDef: ErrorDefinitionEntry,
  params?: Record<string, string>,
  subject?: string | null,
  context?: ErrorContext | null
): TemplateError;

export function createLog(
  type: 'warning',
  errorDef: ErrorDefinitionEntry,
  params?: Record<string, string>,
  subject?: string | null,
  context?: WarningContext | null
): TemplateWarning;

export function createLog(
  type: string,
  errorDefOrData: ErrorDefinitionEntry | { message: string; lineno?: number | null; colno?: number | null; info?: ErrorInfo | WarningInfo },
  paramsOrContext?: Record<string, string> | Record<string, unknown>,
  subject?: string | null,
  context?: ErrorContext | null
): TemplateError | TemplateWarning {
  if (!isErrorDefinitionEntry(errorDefOrData)) {
    throw new Error('createLog: second argument must be an ErrorDefinitionEntry');
  }

  const errorDef = errorDefOrData;
  const params = paramsOrContext as Record<string, string> | undefined;

  if (type === 'error') {
    const normalized = normalizeErrorContext(context);
    const extraKeys = ['lineno', 'colno', 'phase', 'templateName', 'lineBase', 'varName', 'undefinedMode'];
    const extra = context ? Object.fromEntries(
      Object.entries(context).filter(([k]) => !extraKeys.includes(k))
    ) : undefined;
    return createErrorObject(errorDef.message(params), {
      code: errorDef.name,
      subject: subject ?? null,
      ...normalized
    }, extra);
  }

  if (type === 'warning') {
    const normalized = normalizeWarningContext(context);
    return createWarningObject(errorDef.message(params), {
      code: errorDef.name,
      subject: subject ?? null,
      ...normalized
    });
  }

  throw new Error(`Unknown log type: ${type}`);
}

function createErrorObject(
  message: string,
  metadata: {
    code: string | null;
    subject: string | null;
    lineno: number | null;
    colno: number | null;
    phase: string | null;
    templateName: string | null;
    lineBase: LineBase | null;
  },
  extra?: Record<string, unknown>
): TemplateError {
  const err = new Error(message) as TemplateError;
  err.name = 'Template render error';
  err.lineno = metadata.lineno;
  err.colno = metadata.colno;
  err.code = metadata.code;
  err.subject = metadata.subject;
  err.phase = metadata.phase;
  err.templateName = metadata.templateName;
  err.lineBase = metadata.lineBase;

  const storedOptions = extra ? { ...extra } : {};
  err.sourceContent = extra?.sourceContent;

  err.output = function(options: OutputOptions = {}) {
    const mergedOptions = { ...storedOptions, ...options };
    if (err.sourceContent && err.sourceContent !== storedOptions.sourceContent) {
      mergedOptions.sourceContent = err.sourceContent;
    }
    const opts = createFormatterState({
      metadata: {
        lineno: err.lineno,
        colno: err.colno,
        phase: err.phase,
        templateName: err.templateName,
        code: err.code,
        subject: err.subject,
        renderContext: undefined,
        lineBase: err.lineBase ?? undefined
      },
      options: mergedOptions
    });

    if (options.format === 'html') return toHtml(err, opts);
    if (options.format === 'ansi') return toAnsi(err, opts);
    if (options.format === 'text') return toText(err, opts);

    return toHtml(err, opts);
  };

  return err;
}

function createWarningObject(
  message: string,
  metadata: {
    code: string | null;
    subject: string | null;
    lineno: number | null;
    colno: number | null;
    phase: string | null;
    templateName: string | null;
    lineBase: LineBase | null;
    varName: string | null;
    undefinedMode: string;
  }
): TemplateWarning {
  const warning: TemplateWarning = {
    message,
    lineno: metadata.lineno,
    colno: metadata.colno,
    varName: metadata.varName ?? null,
    templateName: metadata.templateName,
    undefinedMode: metadata.undefinedMode,
    code: metadata.code,
    subject: metadata.subject,
    phase: metadata.phase,
    lineBase: metadata.lineBase,

    output(options: Omit<OutputOptions, 'format' | 'isProduction'> = {}) {
      const state = createFormatterState({
        metadata: {
          lineno: warning.lineno,
          colno: warning.colno,
          phase: warning.phase,
          templateName: warning.templateName,
          code: warning.code,
          subject: warning.subject,
          renderContext: undefined,
          lineBase: warning.lineBase ?? undefined
        },
        options
      });
      return toConsoleString(warning, state);
    }
  };

  return warning;
}
