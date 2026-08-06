import type { LineBase } from '../line-base.ts';
import type { SourceTrace } from './internal/source-trace.ts';
import type { ErrorLike } from '../types.ts';

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
  severity: 'error' | 'warning' | 'info';
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
  renderContext?: object;
  phase?: string | null;
  version?: string;
  timestamp?: string;
  csp?: Csp;
  jsCaller?: string;
  jsCallerErrorLine?: number;
  sourceTrace?: SourceTrace | null;
  ide?: string;
  verbosity?: 'simple' | 'medium' | 'full';
  isJsCaller?: boolean;
  isProduction?: boolean;
}

export type { Csp, HumanTitleInput, ClassifiedError, LocationInfo, ToHtmlOptions };
