import type { ErrorSeverity } from '@nunjucks/error-catalog';
import { DEFAULT_IDE } from './presentation/ide-links/defaults.ts';
import { isFilePath } from './presentation/ide-links/ide-links.ts';
import { shortenPath } from './presentation/source-trace/path-shortener.ts';
import type { SourceTrace } from './presentation/source-trace/source-trace.ts';
import {
  buildErrorBodyContent,
  buildErrorFooter,
  buildErrorHeader,
  buildHtmlWrapper,
} from './to-html-builder.ts';
import { buildErrorDisplay } from './to-html-display.ts';
import type { ClassifiedError, ErrorLike } from './to-html-types.ts';

interface ErrorSectionsInput {
  error: ErrorLike;
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  renderContext?: Record<string, unknown>;
  version?: string;
  timestamp?: string | undefined;
  environment?: string | null;
  sourceTrace?: SourceTrace | null | undefined;
  ide?: string;
  verbosity?: 'simple' | 'medium' | 'full';
  isJsCaller?: boolean;
  humanTitle?: string;
  classified?: ClassifiedError;
  projectRoot?: string;
}

interface ErrorSections {
  header: string;
  body: string;
  footer: string;
  wrapped: string;
  message: string;
  severity: ErrorSeverity;
  displayPath: string;
  displayLine: number;
  displayCol: number;
  locDisplay: string;
  canLinkLocation: boolean;
}

// WHY: shared assembly for both toHtml (full document) and toHtmlMarker (inline marker + modal). Computes the error title, display coords, and builds the header/body/footer/wrapper sections so neither renderer duplicates this pipeline.
const buildErrorSections = (input: ErrorSectionsInput): ErrorSections => {
  const {
    error,
    templatePath,
    lineno,
    colno,
    renderContext,
    version,
    timestamp,
    environment,
    sourceTrace,
    ide = DEFAULT_IDE,
    verbosity = 'full',
    isJsCaller = false,
    humanTitle: providedTitle,
    classified: providedClassified,
    projectRoot,
  } = input;
  // WHY: fall back to error.renderContext when the caller didn't pass it explicitly — the error object carries renderContext after wrapWithLog enrichment, so callers like toHtmlMarker (via pipeRenderStream) don't need to thread it through manually.
  const effectiveRenderContext = renderContext ?? error.renderContext;
  const effectiveTimestamp = timestamp ?? error.timestamp;
  const effectiveEnvironment = environment ?? error.environment ?? null;
  const humanTitle = providedTitle ?? error.message ?? 'Unknown error';
  const {
    classified: computedClassified,
    displayLine,
    displayCol,
    displayPath,
  } = buildErrorDisplay(error, {
    templatePath,
    lineno: lineno ?? undefined,
    colno: colno ?? undefined,
    isJsCaller,
  });
  const classified = providedClassified ?? computedClassified;
  const locDisplay = `${shortenPath(displayPath, projectRoot ?? '')}:${displayLine}:${displayCol}`;
  const canLinkLocation = isFilePath(displayPath);

  const header = buildErrorHeader({
    humanTitle,
    category: classified.category,
    phase: error.phase ?? null,
    environment: effectiveEnvironment,
    verbosity,
    displayPath,
    displayLine,
    displayCol,
    ide,
    canLinkLocation,
    locDisplay,
  });
  const body = buildErrorBodyContent({
    verbosity,
    error,
    classified,
    sourceTrace,
    renderContext: effectiveRenderContext,
    ide,
  });
  const footer = buildErrorFooter({
    version: version ?? '',
    timestamp: effectiveTimestamp,
    verbosity,
    canLinkLocation,
    ide,
    displayPath,
    displayLine,
    displayCol,
  });
  const wrapped = buildHtmlWrapper({ header, errorBody: body, footer });

  return {
    header,
    body,
    footer,
    wrapped,
    message: humanTitle,
    severity: classified.severity,
    displayPath,
    displayLine,
    displayCol,
    locDisplay,
    canLinkLocation,
  };
};

export type { ErrorSections, ErrorSectionsInput };
export { buildErrorSections };
