import type { LineBase } from '@nunjucks/error-catalog';
import type { Phase } from '@nunjucks/shared';
import { DEFAULT_IDE } from '../ide-links/defaults.ts';
import type { SourceTrace } from '../source-trace/source-trace.ts';

/** Log metadata normalized for the formatter: location, identity, and context fields. */
export interface NormalizedLogMetadata {
  lineno: number | null;
  colno: number | null;
  code: string | null;
  subject: string | null;
  phase: Phase | null;
  templateName: string | null;
  templatePath?: string | null;
  renderContext?: Record<string, unknown>;
  lineBase: LineBase;
}

interface FormatterStateInput {
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
    humanTitle?: string;
  };
}

interface FormatterState {
  dev: boolean;
  ide: string;
  verbosity: 'simple' | 'medium' | 'full';
  phase: Phase | null;
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
  humanTitle?: string;
}

// WHY: isProduction must never stay disconnected from dev — a caller that renders error
// pages with dev:false (the default) is by definition NOT asking for the rich dev page.
// Deriving the fallback here makes the production "Rendering Interrupted" page the
// safe-by-default output; only dev:true (or an explicit isProduction:false) opts into
// stack traces, source excerpts, and render-context sections.
export const createFormatterState = ({
  metadata,
  options = {},
}: FormatterStateInput): FormatterState => ({
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
  isProduction: options.isProduction ?? !(options.dev ?? false),
  humanTitle: options.humanTitle,
});
