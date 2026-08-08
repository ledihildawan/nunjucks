import type { LineBase } from '@nunjucks/error-catalog';
import type { SourceTrace } from '../location/source-trace.ts';
import { DEFAULT_IDE } from '../config/defaults.ts';

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
    sourceTrace?: SourceTrace | null;
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
  sourceTrace?: SourceTrace | null;
  csp?: { nonce?: string };
  jsCaller?: string;
  jsCallerErrorLine?: number;
  isJsCaller?: boolean;
  isProduction?: boolean;
}

export const createFormatterState = ({ metadata, options = {} }: FormatterStateInput): FormatterState => ({
  dev: options.dev ?? false,
  ide: options.ide ?? DEFAULT_IDE,
  verbosity: options.verbosity ?? 'full',
  phase: metadata.phase,
  templateName: metadata.templateName,
  lineno: metadata.lineno,
  colno: metadata.colno,
  templatePath: options.templatePath ?? metadata.templatePath ?? undefined,
  renderContext: metadata.renderContext ?? options.renderContext,
  version: options.version,
  timestamp: options.timestamp,
  sourceTrace: options.sourceTrace,
  csp: options.csp,
  jsCaller: options.jsCaller,
  jsCallerErrorLine: options.jsCallerErrorLine,
  isJsCaller: options.isJsCaller,
  isProduction: options.isProduction
});
