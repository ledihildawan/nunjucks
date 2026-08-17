import type { LineBase } from '@nunjucks/error-catalog';
import { ERROR_CODES } from '@nunjucks/error-catalog';
import { createLog, normalizeErrorMetadata, type TemplateError } from '@nunjucks/error-formatter';
import { DEFAULT_IDE } from '@nunjucks/error-renderer';
import { isKeyedObject } from '@nunjucks/lib';
import type { Phase } from '@nunjucks/shared';
import { type CallerLocation, type LocationInputs, resolveLocation } from './error-location.ts';
import { templateLiteralText } from './error-location-matching.ts';
import {
  buildErrorDef,
  extractErrorSnapshot,
  resolveErrorProps,
  toRenderContext,
} from './error-snapshot.ts';

interface DiagnosticsConfig {
  phase?: Phase | null;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  callerFile?: string | null;
  callerLocation?: {
    fileName: string;
    lineNumber?: number | null;
    columnNumber?: number | null;
  } | null;
  callerFrames?: readonly CallerLocation[] | null;
  dev?: boolean;
  ide?: string;
  lineno?: number | null;
  colno?: number | null;
  blockedContextKeys?: readonly string[] | null;
  environment?: string | null;
}

interface DiagnosticsBuildInput {
  metadata: ReturnType<typeof normalizeErrorMetadata>;
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  renderContext: Record<string, unknown> | null;
  preferCallerLocation: boolean;
  dev: boolean | null;
  ide: string | null;
  timestamp: string | null;
  environment: string | null;
}

export { findContextKeyPosition } from './find-context-key-position.ts';
export { readProjectSource } from './project-source-reader.ts';

const buildContextObj = (input: DiagnosticsBuildInput): Record<string, unknown> => ({
  lineno: input.metadata.lineno,
  colno: input.metadata.colno,
  phase: input.metadata.phase,
  templateName: input.preferCallerLocation
    ? (input.templatePath ?? input.metadata.templateName)
    : input.metadata.templateName,
  lineBase: input.metadata.lineBase,
  dev: input.dev,
  ide: input.ide,
  templatePath: input.templatePath ?? undefined,
  sourceContent: input.sourceContent ?? undefined,
  sourceStartLine: input.sourceStartLine,
  renderContext: input.renderContext ?? undefined,
  timestamp: input.timestamp,
  environment: input.environment,
  verbosity: 'full',
  isJsCaller: input.preferCallerLocation,
});

interface MetadataInput {
  lineno: number | null;
  colno: number | null;
  lineBase: LineBase;
  phase: Phase;
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  renderContext: unknown;
}

const buildMetadata = (errSnapshot: Record<string, unknown>, input: MetadataInput) =>
  normalizeErrorMetadata(errSnapshot, {
    lineno: input.lineno,
    colno: input.colno,
    lineBase: input.lineBase,
    phase: input.phase,
    templateName: input.templatePath,
    templatePath: input.templatePath,
    sourceContent: input.sourceContent,
    sourceStartLine: input.sourceStartLine,
    renderContext: toRenderContext(input.renderContext),
    code: typeof errSnapshot.code === 'string' ? errSnapshot.code : ERROR_CODES.RENDER_ERROR,
  });

interface ErrorObjectInput {
  resolvedProps: ReturnType<typeof resolveErrorProps>;
  contextObj: ReturnType<typeof buildContextObj>;
  templatePath: string | null;
  sourceStartLine: number;
  blockedKeys?: readonly string[] | null;
}

const createErrorObject = (
  metadata: ReturnType<typeof normalizeErrorMetadata>,
  input: ErrorObjectInput
): TemplateError => {
  const errorDef = buildErrorDef(metadata, input.resolvedProps);
  const errorObj = createLog('error', {
    def: errorDef,
    params: {},
    subject: metadata.subject,
    context: input.contextObj,
  });
  return Object.assign(errorObj, {
    templatePath: input.templatePath,
    sourceStartLine: input.sourceStartLine,
    renderContext: metadata.renderContext ?? undefined,
    ...(input.blockedKeys && input.blockedKeys.length > 0
      ? { blockedKeys: input.blockedKeys }
      : {}),
  });
};

const resolveEffectiveBlockedKeys = (
  err: unknown,
  config: DiagnosticsConfig
): readonly string[] | null => {
  const errRecord = isKeyedObject(err) ? err : null;
  const incoming = errRecord?.blockedKeys;
  if (
    Array.isArray(incoming) &&
    incoming.length > 0 &&
    incoming.every((key): key is string => typeof key === 'string')
  ) {
    return incoming;
  }
  return config.blockedContextKeys ?? null;
};

interface LocationInputsBuild {
  config: DiagnosticsConfig;
  template: string | null;
  metadata: ReturnType<typeof normalizeErrorMetadata>;
}

const buildLocationInputs = ({
  config,
  template,
  metadata,
}: LocationInputsBuild): LocationInputs => ({
  template,
  templatePath: config.templatePath ?? null,
  jsCaller: config.jsCaller ?? null,
  jsCallerErrorLine: config.jsCallerErrorLine ?? null,
  jsCallerErrorCol: config.jsCallerErrorCol ?? null,
  callerFile: config.callerFile ?? null,
  callerLocation: config.callerLocation ?? null,
  callerFrames: config.callerFrames ?? null,
  errLineno: metadata.lineno,
  errColno: metadata.colno,
  errLineBase: metadata.lineBase,
  lineno: config.lineno ?? null,
  colno: config.colno ?? null,
  subject: metadata.subject,
});

// WHY: wrapWithLog is the error-enrichment shell — the SECOND pass in a two-layer pipeline:
//
//   Layer 1 (runtime): handleError() normalizes the raw error, looks up the catalog
//     definition (causes, fixCode, fixComment), and creates a TemplateError. This error
//     has correct code/message/subject/lineno but NO source trace or caller-location data.
//
//   Layer 2 (diagnostics): wrapWithLog() receives the Layer-1 error and adds:
//     a) resolveLocation() — reads caller source files to map template offsets → file:line
//     b) resolveErrorProps() — preserves causes/fixCode from the Layer-1 error
//     c) createErrorObject() — re-creates the error with full metadata + location + timestamp
//
//   The double normalizeErrorMetadata() call is intentional: Layer 1 normalizes the RAW
//   error (may be a plain Error, TypeError, etc.), Layer 2 normalizes the ENRICHED
//   TemplateError (consistent shape). Both pass through the same field-extraction logic.
//
//   In streaming mode, streamError() sits between the layers: it calls handleError (Layer 1)
//   and catches the throw, returning a sentinel. formatStreamSentinel then calls wrapWithLog
//   (Layer 2) on the sentinel's error.
interface WrapWithLogInput {
  error: unknown;
  config: DiagnosticsConfig;
  template?: unknown;
  renderContext?: unknown;
}

/**
 * Enriches a raw render error into a fully-located `TemplateError` — the
 * second pass of the two-layer error pipeline (runtime `handleError` normalizes
 * first; see the WHY above for the full layer split).
 *
 * Reads caller project sources off disk (`resolveLocation`) to map template
 * offsets to caller `file:line:col`, then re-creates the error with full
 * metadata, resolved location, environment label, and timestamp.
 *
 * @param error - Raw or Layer-1-normalized error of any shape.
 * @param config - Diagnostics inputs: `phase`, `dev`, `ide`, template/caller
 *   location hints, and `environment` label.
 * @param template - Template source (inline string or literal value) used for
 *   source traces and caller-source matching. Defaults to `null`.
 * @param renderContext - Context snapshot attached to the enriched error.
 *   Defaults to `null`.
 * @returns The enriched, fully-located `TemplateError`.
 */
export const wrapWithLog = async ({
  error,
  config,
  template = null,
  renderContext = null,
}: WrapWithLogInput): Promise<TemplateError> => {
  const resolvedSourceContent = typeof template === 'string' ? template : null;
  const initialMetadata = normalizeErrorMetadata(error, {
    phase: config.phase ?? 'render',
    templatePath: config.templatePath ?? config.callerFile ?? null,
    sourceContent: resolvedSourceContent,
    renderContext: toRenderContext(renderContext),
  });

  // WHY: caller-source matching needs the STRINGIFIED template value (e.g. `123`, `null`) to locate the
  // invalid literal argument in the caller file — nulling it here would misguide the search hint to 'null'.
  const locationTemplateHint =
    typeof template === 'string' ? template : templateLiteralText(template);
  const resolved = await resolveLocation(
    buildLocationInputs({ config, template: locationTemplateHint, metadata: initialMetadata })
  );

  const {
    lineno,
    colno,
    lineBase,
    templatePath,
    sourceContent,
    sourceStartLine,
    preferCallerLocation,
  } = resolved;
  const errSnapshot = extractErrorSnapshot(error);
  const phase = initialMetadata.phase ?? config.phase ?? 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? DEFAULT_IDE;
  // WHY: wrapWithLog is the error-enrichment shell — resolveLocation() above performs I/O to map template offsets to caller file:line. The timestamp is consistent with that impure role; render-boundary callers don't need to thread it through.
  const timestamp = new Date().toISOString();
  // WHY: environment is threaded config (set once at the factory shell from the process env) — reading
  // process.env here would couple this module to a Node global and break non-Node runtimes. 'development'
  // fallback preserves the previous display default when no environment was provided.
  const environment = config.environment ?? 'development';

  const metadata = buildMetadata(errSnapshot, {
    lineno,
    colno,
    lineBase,
    phase,
    templatePath,
    sourceContent,
    sourceStartLine,
    renderContext,
  });
  const resolvedProps = resolveErrorProps(error);
  const contextObj = buildContextObj({
    metadata,
    templatePath,
    sourceContent,
    sourceStartLine,
    renderContext: toRenderContext(renderContext),
    preferCallerLocation,
    dev: dev ?? null,
    ide,
    timestamp,
    environment,
  });

  const effectiveBlockedKeys = resolveEffectiveBlockedKeys(error, config);
  return createErrorObject(metadata, {
    resolvedProps,
    contextObj,
    templatePath,
    sourceStartLine,
    blockedKeys: effectiveBlockedKeys,
  });
};
