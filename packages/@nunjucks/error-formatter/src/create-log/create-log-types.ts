import type { LineBase } from '@nunjucks/error-catalog';
import { TEMPLATE_ERROR } from '@nunjucks/error-catalog';
import type { Phase, UndefinedMode } from '@nunjucks/shared';

interface ErrorDefinitionEntry {
  name: string;
  message: ((args?: Record<string, string> | string[]) => string) | string;
  pattern: RegExp;
  causes?: readonly string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: 'error' | 'warning' | 'info';
}

interface ErrorInfo {
  code?: string | null;
  subject?: string | null;
  phase?: Phase | null;
  templateName?: string | null;
  renderContext?: Record<string, unknown>;
  blockedKeys?: readonly string[];
  lineBase?: LineBase | null;
  dev?: boolean;
}

interface WarningInfo extends ErrorInfo {
  varName?: string | null;
  undefinedMode?: UndefinedMode;
}

interface ProjectSourceLocation {
  path: string;
  line: number | null;
  col: number | null;
}

interface ProjectSourceContent {
  sourceContent: string;
  templatePath: string;
  lineno: number;
  colno: number;
}

type SourceFileReader = (location: ProjectSourceLocation) => ProjectSourceContent | null;

interface OutputOptions {
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
  humanTitle?: string;
  sourceFileReader?: SourceFileReader;
}

interface TemplateError extends Error {
  name: 'Template render error';
  lineno: number | null;
  colno: number | null;
  code: string | null;
  subject: string | null;
  phase: Phase | null;
  templateName: string | null;
  templatePath: string | null;
  renderContext?: Record<string, unknown>;
  blockedKeys?: readonly string[];
  lineBase?: LineBase | null;
  sourceContent?: string;
  sourceStartLine?: number;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
  documentationUrl?: string | null;
  severity?: 'error' | 'warning' | 'info';
  path?: string | null;
  toJSON?: () => Record<string, unknown>;
  outputOptions?: Omit<OutputOptions, 'format'>;
  includeChain?: IncludeChain;
  [TEMPLATE_ERROR]?: boolean;
}

interface TemplateWarning {
  message: string;
  lineno: number | null;
  colno: number | null;
  varName: string | null;
  templateName: string | null;
  undefinedMode: UndefinedMode;
  code: string | null;
  subject: string | null;
  phase: Phase | null;
  lineBase?: LineBase | null;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
}

interface ErrorContext {
  lineno?: number | null;
  colno?: number | null;
  phase?: Phase | null;
  templateName?: string | null;
  templatePath?: string | null;
  lineBase?: LineBase | null;
  // WHY: null-tolerant — normalizeErrorMetadata yields null when absent; requiring string
  // forced callers into a masking cast (handle-error.ts).
  sourceContent?: string | null;
  sourceStartLine?: number;
  timestamp?: string | null;
  environment?: string | null;
  renderContext?: Record<string, unknown> | null;
}

interface WarningContext extends ErrorContext {
  varName?: string | null;
  undefinedMode?: UndefinedMode | null;
}

interface BaseContext {
  lineno: number | null;
  colno: number | null;
  phase: Phase | null;
  templateName: string | null;
  lineBase: LineBase | null;
  timestamp: string | null;
  environment: string | null;
}

interface NormalizedErrorContext extends BaseContext {}

interface NormalizedWarningContext extends BaseContext {
  varName: string | null;
  undefinedMode: UndefinedMode;
}

interface IncludeChain {
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

interface RawLogData {
  message: string;
  lineno?: number | null;
  colno?: number | null;
  info?: ErrorInfo | WarningInfo;
}

type LogType = 'error' | 'warning';

export type { ErrorDefinitionEntry, ErrorInfo, WarningInfo, OutputOptions, ProjectSourceLocation, ProjectSourceContent, SourceFileReader, TemplateError, TemplateWarning, ErrorContext, WarningContext, IncludeChain, PrettifyErrorOptions, RawLogData, LogType, BaseContext, NormalizedErrorContext, NormalizedWarningContext };
export { TEMPLATE_ERROR };
