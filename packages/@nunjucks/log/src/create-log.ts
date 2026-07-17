import { toHtml } from './error/to-html.js';
import type { CSS, PRODUCTION_BODY, TOGGLE_SCRIPT } from './error/to-html.js';
import { toAnsi } from './error/to-ansi.js';
import { toText } from './error/to-text.js';
import { toConsoleString } from './error/to-console.js';
import type { LineBase } from './error/location.js';
import { createFormatterState, normalizeLogMetadata } from './error/metadata.js';

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
  lineBase?: LineBase | null;
  output: (options?: Omit<OutputOptions, 'format' | 'isProduction'>) => string;
}

export function createLog(type: 'error', data: { message: string; lineno?: number | null; colno?: number | null; info?: ErrorInfo }, renderContext?: Record<string, unknown>): TemplateError;
export function createLog(type: 'warning', data: { message: string; lineno?: number | null; colno?: number | null; info?: WarningInfo }, renderContext?: Record<string, unknown>): TemplateWarning;
export function createLog(type: string, data: { message: string; lineno?: number | null; colno?: number | null; info?: ErrorInfo | WarningInfo }, renderContext?: Record<string, unknown>): TemplateError | TemplateWarning {
  const { message, lineno: topLineno, colno: topColno, info = {} } = data;
  const metadata = normalizeLogMetadata({
    lineno: topLineno,
    colno: topColno,
    renderContext,
    ...info
  });

  if (type === 'error') {
    return createErrorObject(message, metadata);
  } else if (type === 'warning') {
    return createWarningObject(message, {
      ...metadata,
      ...info
    } as ReturnType<typeof normalizeLogMetadata> & WarningInfo);
  }
  throw new Error(`Unknown log type: ${type}`);
}

function createErrorObject(message: string, metadata: ReturnType<typeof normalizeLogMetadata>): TemplateError {
  const err = new Error(message) as TemplateError;
  err.name = 'Template render error';
  err.lineno = metadata.lineno;
  err.colno = metadata.colno;
  err.code = metadata.code;
  err.subject = metadata.subject;
  err.phase = metadata.phase;
  err.templateName = metadata.templateName;
  err.renderContext = metadata.renderContext;
  err.lineBase = metadata.lineBase;

  err.output = function(options: OutputOptions = {}) {
    const opts = createFormatterState({
      metadata,
      options
    });

    if (options.format === 'html') return toHtml(err, opts);
    if (options.format === 'ansi') return toAnsi(err, opts);
    if (options.format === 'text') return toText(err, opts);

    return { html: toHtml(err, opts), ansi: toAnsi(err, opts), text: toText(err, opts) };
  };

  return err;
}

function createWarningObject(message: string, metadata: ReturnType<typeof normalizeLogMetadata> & WarningInfo): TemplateWarning {
  const warning: TemplateWarning = {
    message,
    lineno: metadata.lineno,
    colno: metadata.colno,
    varName: metadata.varName ?? null,
    templateName: metadata.templateName,
    undefinedMode: metadata.undefinedMode ?? 'chainable',
    code: metadata.code,
    subject: metadata.subject,
    lineBase: metadata.lineBase,

    output(options: Omit<OutputOptions, 'format' | 'isProduction'> = {}) {
      const state = createFormatterState({
        metadata,
        options
      });
      return toConsoleString(warning, state);
    }
  };

  return warning;
}
