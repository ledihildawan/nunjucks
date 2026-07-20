import type { LineBase } from './location.ts';

export interface LogMetadataInput {
  lineno?: number | null;
  colno?: number | null;
  code?: string | null;
  subject?: string | null;
  phase?: string | null;
  templateName?: string | null;
  templatePath?: string | null;
  renderContext?: Record<string, unknown>;
  lineBase?: LineBase | null;
}

export interface NormalizedLogMetadata {
  lineno: number | null;
  colno: number | null;
  code: string | null;
  subject: string | null;
  phase: string | null;
  templateName: string | null;
  templatePath?: string | null;
  renderContext?: Record<string, unknown>;
  lineBase: LineBase;
}

export interface FormatterStateInput {
  metadata: NormalizedLogMetadata;
  options?: {
    dev?: boolean;
    ide?: string;
    verbosity?: 'simple' | 'medium' | 'full';
    templatePath?: string;
    version?: string;
    timestamp?: string;
    sourceContent?: string;
    sourceStartLine?: number;
    snippet?: string;
    csp?: { nonce?: string };
    jsCaller?: string;
    jsCallerErrorLine?: number;
    isJsCaller?: boolean;
    isProduction?: boolean;
    renderContext?: Record<string, unknown>;
  };
}

export interface FormatterState {
  dev: boolean;
  ide: string;
  verbosity: 'simple' | 'medium' | 'full';
  phase: string | null;
  templateName: string | null;
  lineno: number | null;
  colno: number | null;
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
  isProduction?: boolean;
}

export const normalizeLogMetadata = (input: LogMetadataInput = {}): NormalizedLogMetadata => ({
  lineno: input.lineno ?? null,
  colno: input.colno ?? null,
  code: input.code ?? null,
  subject: input.subject ?? null,
  phase: input.phase ?? null,
  templateName: input.templateName ?? null,
  templatePath: input.templatePath ?? input.templateName ?? null,
  renderContext: input.renderContext,
  lineBase: input.lineBase === 'one' ? 'one' : 'zero'
});

export const createFormatterState = ({ metadata, options = {} }: FormatterStateInput): FormatterState => ({
  dev: options.dev ?? false,
  ide: options.ide ?? 'vscode',
  verbosity: options.verbosity ?? 'full',
  phase: metadata.phase,
  templateName: metadata.templateName,
  lineno: metadata.lineno,
  colno: metadata.colno,
  templatePath: options.templatePath ?? metadata.templatePath ?? undefined,
  renderContext: metadata.renderContext ?? options.renderContext,
  version: options.version,
  timestamp: options.timestamp,
  sourceContent: options.sourceContent,
  sourceStartLine: options.sourceStartLine,
  snippet: options.snippet,
  csp: options.csp,
  jsCaller: options.jsCaller,
  jsCallerErrorLine: options.jsCallerErrorLine,
  isJsCaller: options.isJsCaller,
  isProduction: options.isProduction
});
