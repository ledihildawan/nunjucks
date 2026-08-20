import type { ErrorLike, ErrorSeverity, LineBase } from '@nunjucks/error-catalog';
import type { Phase } from '@nunjucks/shared';
import type { SourceTrace } from './presentation/source-trace/source-trace.ts';

export type { ErrorLike };

/** Content-Security-Policy options; the nonce is escaped and threaded onto style/script tags. */
interface Csp {
  nonce?: string;
}

/** Inputs for resolving a human-facing title from a classified code name and plain message. */
interface HumanTitleInput {
  name: string | null;
  undefinedName: string | null;
  plain: string;
  fallback: string;
}

/** Catalog classification merged with the renderer-specific fields the HTML page displays. */
interface ClassifiedError {
  category: string;
  undefinedName: string | null;
  title: string;
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
  severity: ErrorSeverity;
}

/** Resolved 1-based display coordinates plus the display path and its originating `LineBase`. */
interface LocationInfo {
  displayLine: number;
  displayCol: number;
  displayPath: string;
  lineBaseValue: LineBase;
}

/**
 * Options for the HTML error page; production output is safe-by-default — an unspecified
 * `isProduction` derives to `!(dev ?? false)` so stack, render context, and source
 * content never ship without an explicit opt-in.
 */
interface ToHtmlOptions {
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  renderContext?: Record<string, unknown>;
  phase?: Phase | null;
  version?: string;
  timestamp?: string;
  csp?: Csp;
  jsCaller?: string;
  jsCallerErrorLine?: number;
  sourceTrace?: SourceTrace | null;
  ide?: string;
  verbosity?: 'simple' | 'medium' | 'full';
  isJsCaller?: boolean;
  // WHY: safe-by-default — when neither flag is set, isProduction derives to !(dev ?? false)
  // inside toHtml, so a forgotten flag can never ship a full dev page (stack, render
  // context, source content) to production clients.
  dev?: boolean;
  isProduction?: boolean;
  humanTitle?: string;
  projectRoot?: string;
}

export type { ClassifiedError, Csp, HumanTitleInput, LocationInfo, ToHtmlOptions };
