import type { ErrorLike, ErrorSeverity, LineBase } from '@nunjucks/error-catalog';
import type { Phase } from '@nunjucks/shared';
import type { SourceTrace } from './presentation/source-trace/source-trace.ts';

export type { ErrorLike };

interface Csp {
  nonce?: string;
}

interface HumanTitleInput {
  category: string;
  undefinedName: string | null;
  plain: string;
  fallback: string;
}

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

interface LocationInfo {
  displayLine: number;
  displayCol: number;
  displayPath: string;
  lineBaseValue: LineBase;
}

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
