import { isFunction, isString } from 'remeda';
import type { LineBase } from './render/internal/location.ts';
import { normalizeLineBase } from './render/internal/location.ts';
import { createFormatterState } from './render/internal/metadata.ts';

export interface ErrorDefinitionEntry {
  name: string;
  message: ((args?: Record<string, string> | string[]) => string) | string;
  pattern: RegExp;
}

const resolveMessage = (message: ErrorDefinitionEntry['message'], params?: Record<string, string>): string => {
  if (isFunction(message)) return message(params);
  if (isString(message) && params) return message.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
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
  toJSON?: () => Record<string, unknown>;
  outputOptions?: Omit<OutputOptions, 'format'>;
  output: (options?: OutputOptions) => { html: string; ansi: string; text: string } | string;
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

const isErrorDefinitionEntry = (data: any): data is ErrorDefinitionEntry =>
  typeof data === 'object' &&
  data !== null &&
  'message' in data &&
  (typeof data.message === 'function' || typeof data.message === 'string') &&
  !('lineno' in data);

interface LegacyLogData {
  message: string;
  lineno?: number | null;
  colno?: number | null;
  info?: ErrorInfo | WarningInfo;
}

type LogType = 'error' | 'warning';

const createBaseMetadata = (message: string, data: LegacyLogData, info: ErrorInfo | WarningInfo, type: LogType) => ({
  message,
  lineno: data.lineno ?? null,
  colno: data.colno ?? null,
  code: info.code ?? null,
  subject: info.subject ?? null,
  phase: info.phase ?? null,
  templateName: info.templateName ?? null,
  lineBase: info.lineBase ?? null,
  ...(type === 'warning' ? { varName: (info as WarningInfo).varName ?? null, undefinedMode: (info as WarningInfo).undefinedMode ?? 'chainable' } : {})
});

const createOutputFn = (type: 'error' | 'warning') => {
  if (type === 'error') {
    return function(this: TemplateError, options: OutputOptions = {}) {
      const opts = createFormatterState({
        metadata: {
          lineno: this.lineno,
          colno: this.colno,
          phase: this.phase,
          templateName: this.templateName,
          code: this.code,
          subject: this.subject,
          renderContext: this.renderContext,
          lineBase: normalizeLineBase(this.lineBase)
        },
        options
      });

      if (options.format === 'ansi') return require('./render/to-ansi.ts').toAnsi(this, opts);
      if (options.format === 'text') return require('./render/to-text.ts').toText(this, opts);
      return require('./render/to-html.ts').toHtml(this, opts);
    };
  }
  return function(this: TemplateWarning, options: Omit<OutputOptions, 'format' | 'isProduction'> = {}) {
    const state = createFormatterState({
      metadata: {
        lineno: this.lineno,
        colno: this.colno,
        phase: this.phase,
        templateName: this.templateName,
        code: this.code,
        subject: this.subject,
        renderContext: undefined,
        lineBase: normalizeLineBase(this.lineBase)
      },
      options
    });
    return require('./render/to-console.ts').toConsoleString(this, state);
  };
};

export function createLog(
  type: string,
  errorDefOrData: ErrorDefinitionEntry | LegacyLogData,
  params?: Record<string, string>,
  subject?: string | null,
  context?: ErrorContext | null
): TemplateError | TemplateWarning {
  if (!isErrorDefinitionEntry(errorDefOrData)) {
    if (type !== 'error' && type !== 'warning') throw new Error(`Unknown log type: ${type}`);
    const info = (errorDefOrData.info ?? {}) as WarningInfo;
    const base = createBaseMetadata(errorDefOrData.message, errorDefOrData, info, type);

    if (type === 'error') {
      const err = new Error(base.message) as TemplateError;
      Object.assign(err, { name: 'Template render error', code: base.code, subject: base.subject, lineno: base.lineno, colno: base.colno, phase: base.phase, templateName: base.templateName, lineBase: base.lineBase, templatePath: base.templateName });
      err.output = createOutputFn('error');
      return err;
    }

    const warn: TemplateWarning = { message: base.message, lineno: base.lineno, colno: base.colno, varName: info.varName ?? null, templateName: base.templateName, undefinedMode: info.undefinedMode ?? 'chainable', code: base.code, subject: base.subject, phase: base.phase, lineBase: base.lineBase, output: null! };
    warn.output = createOutputFn('warning');
    return warn;
  }

  const errorDef = errorDefOrData;
  if (type !== 'error' && type !== 'warning') throw new Error(`Unknown log type: ${type}`);
  const paramsValue = params as Record<string, string> | undefined;
  const normalized = type === 'error'
    ? normalizeContext<NormalizedErrorContext>(context as ErrorContext, () => ({}))
    : normalizeContext<NormalizedWarningContext>(context as WarningContext, (c) => ({ varName: (c as WarningContext).varName ?? null, undefinedMode: (c as WarningContext).undefinedMode ?? 'chainable' }));

  const extraKeys = ['lineno', 'colno', 'phase', 'templateName', 'lineBase', 'varName', 'undefinedMode'];
  const extra = context ? Object.fromEntries(Object.entries(context).filter(([k]) => !extraKeys.includes(k))) : undefined;

  if (type === 'error') {
    const err = new Error(resolveMessage(errorDef.message, paramsValue)) as TemplateError;
    Object.assign(err, { name: 'Template render error', code: errorDef.name, subject: subject ?? null, ...normalized });
    if (extra?.sourceContent) err.sourceContent = extra.sourceContent;
    if (extra && Number.isInteger(extra.sourceStartLine)) err.sourceStartLine = extra.sourceStartLine;
    err.templatePath = normalized.templateName;
    err.toJSON = function() {
      return { name: this.name, code: this.code, subject: this.subject, message: this.message, phase: this.phase, templateName: this.templateName, templatePath: this.templatePath, sourceStartLine: this.sourceStartLine, lineno: this.lineno, colno: this.colno, lineBase: this.lineBase, stack: this.stack };
    };
    err.output = createOutputFn('error');
    return err;
  }

  const normalizedWarning = normalized as NormalizedWarningContext;
  const warn: TemplateWarning = { message: resolveMessage(errorDef.message, paramsValue), code: errorDef.name, subject: subject ?? null, ...normalizedWarning, output: null! };
  warn.output = createOutputFn('warning');
  return warn;
}