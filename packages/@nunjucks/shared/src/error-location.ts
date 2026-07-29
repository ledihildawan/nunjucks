// CENTRALIZED ERROR LOCATION RESOLUTION
//
// Single source of truth for "where did this error occur?".
// Replaces the duplicated logic previously spread across:
//
//   - packages/@nunjucks/log/src/diagnostics.ts (resolveErrorLocation, now removed)
//   - packages/@nunjucks/core/src/core/render.ts (caller detection setup)
//   - packages/@nunjucks/runtime/src/helpers.ts (handleError re-wrap)
//
// ## Precedence Order (high to low)
//
// 1. **Caller file location** (`jsCaller` or auto-detected inline caller)
//    When the error happened in an inline template string, look for the
//    template literal in the JS caller source and translate the
//    template-internal (line, col) into the caller's (line, col).
//
// 2. **Caller line fallback** (`_callerLocation`)
//    If we cannot find the template in the caller (multiline strings,
//    source map mismatches), use the caller's raw line/col from V8 stack.
//
// 3. **Template coords** (`errLineno` / `errColno`)
//    The 0-based line/col within the template itself. Used when there is
//    no caller info (loaded templates from disk, etc.).
//
// 4. **Explicit config** (`config.lineno` / `config.colno`)
//    Manual override from the config object.
//
// 5. **Null fallback**
//    When nothing is known, both are `null` and the caller decides what
//    to render.
//
// `lineBase` follows the location that won:
//   - Caller-derived locations are always `one`-based (V8 is 1-based).
//   - Template-coords locations are always `zero`-based (matching AST).

import { readFile } from 'node:fs/promises';

import { extractCallerPosition } from './error-location-matching.ts';
import type { LocationInputs, ResolvedLocation } from './error-location-types.ts';

const determineCallerPreference = (inputs: {
  templatePath: unknown;
  jsCaller: unknown;
  jsCallerErrorLine: unknown;
  _callerFile: unknown;
  _callerLocation: unknown;
}) => {
  const { templatePath, jsCaller, jsCallerErrorLine, _callerFile, _callerLocation } = inputs;
  const useExplicitCaller = jsCaller !== null && jsCaller !== undefined && jsCallerErrorLine !== null && jsCallerErrorLine !== undefined;
  const useAutoCaller =
    !templatePath &&
    jsCaller === null &&
    _callerFile !== null &&
    _callerFile !== undefined &&
    _callerFile !== 'unknown' &&
    _callerLocation !== null &&
    _callerLocation !== undefined;
  return { preferCallerLocation: !templatePath && (useExplicitCaller || useAutoCaller), useExplicitCaller, useAutoCaller };
};

const resolveFinalCoordinates = (
  preferCallerLocation: boolean,
  hasErrorLocation: boolean,
  errLineno: number | null,
  errColno: number | null,
  resolvedCallerLine: number | null,
  resolvedCallerCol: number | null,
  configLineno: number | null,
  configColno: number | null
): { lineno: number | null; colno: number | null; lineBase: 'zero' | 'one' } => {
  if (preferCallerLocation) {
    return {
      lineno: resolvedCallerLine ?? configLineno ?? errLineno ?? null,
      colno: resolvedCallerCol ?? configColno ?? errColno ?? null,
      lineBase: 'one'
    };
  }
  if (hasErrorLocation && errLineno !== null) {
    return { lineno: errLineno, colno: errColno, lineBase: 'zero' };
  }
  return { lineno: configLineno, colno: configColno, lineBase: 'zero' };
};

const tryReadFile = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
};

const resolveCallerFilePosition = async (
  activeCaller: string,
  template: string | null,
  errLineno: number | null,
  errColno: number | null,
  subject: string | null,
  activeCallerLine: number | null
): Promise<{ source: string | null; line: number | null; col: number | null }> => {
  const fileContent = await tryReadFile(activeCaller);
  if (fileContent === null) {
    return { source: null, line: null, col: null };
  }
  const position = extractCallerPosition(
    fileContent,
    template,
    errLineno,
    errColno,
    subject,
    activeCallerLine
  );
  if (!position) {
    return { source: null, line: null, col: null };
  }
  return { source: fileContent, line: position.line, col: position.col };
};

const resolveActiveCaller = (
  useExplicitCaller: boolean,
  useAutoCaller: boolean,
  jsCaller: string | null,
  jsCallerErrorLine: number | null,
  jsCallerErrorCol: number | null,
  _callerFile: string | null,
  _callerLocation: { lineNumber?: number | null; columnNumber?: number | null } | null
): { caller: string | null; line: number | null; col: number | null } => {
  const pickCaller = <T>(explicit: T, auto: T): T | null => {
    if (useExplicitCaller) { return explicit; }
    if (useAutoCaller) { return auto; }
    return null;
  };

  return {
    caller: jsCaller ?? pickCaller<string | null>(null, _callerFile ?? null),
    line: pickCaller<number | null>(jsCallerErrorLine ?? null, _callerLocation?.lineNumber ?? null),
    col: pickCaller<number | null>(jsCallerErrorCol ?? null, _callerLocation?.columnNumber ?? null)
  };
};

const buildResolvedLocation = (
  lineno: number | null,
  colno: number | null,
  lineBase: 'zero' | 'one',
  finalPath: string | null,
  sourceContent: string | null,
  sourceStartLine: number,
  preferCallerLocation: boolean
): ResolvedLocation => ({
  lineno,
  colno,
  lineBase,
  templatePath: finalPath,
  sourceContent,
  sourceStartLine,
  preferCallerLocation
});

const resolveSourceContent = async (
  preferCallerLocation: boolean,
  hasCallerLocation: boolean,
  activeCaller: string | null,
  activeCallerLine: number | null,
  activeCallerCol: number | null,
  template: string | null,
  errLineno: number | null,
  errColno: number | null,
  subject: string | null,
): Promise<{ sourceContent: string | null; sourceStartLine: number; resolvedCallerLine: number | null; resolvedCallerCol: number | null }> => {
  const baseResolvedCallerLine = hasCallerLocation ? (errLineno ?? null) : activeCallerLine;
  const baseResolvedCallerCol = hasCallerLocation ? (errColno ?? null) : activeCallerCol;

  if (preferCallerLocation && activeCaller && !hasCallerLocation) {
    const { source: updatedSource, line: updatedLine, col: updatedCol } = await resolveCallerFilePosition(
      activeCaller,
      template,
      errLineno,
      errColno,
      subject,
      activeCallerLine
    );
    if (updatedSource !== null) {
      return { sourceContent: updatedSource, sourceStartLine: 1, resolvedCallerLine: updatedLine, resolvedCallerCol: updatedCol };
    }
  }

  return { sourceContent: template, sourceStartLine: 1, resolvedCallerLine: baseResolvedCallerLine, resolvedCallerCol: baseResolvedCallerCol };
};

const extractCallerPreference = (
  templatePath: string | null,
  jsCaller: string | null,
  jsCallerErrorLine: number | null,
  _callerFile: string | null,
  _callerLocation: { lineNumber?: number | null; columnNumber?: number | null } | null,
) => {
  return determineCallerPreference({
    templatePath, jsCaller, jsCallerErrorLine, _callerFile, _callerLocation
  });
};

const extractActiveCaller = (
  useExplicitCaller: boolean,
  useAutoCaller: boolean,
  jsCaller: string | null,
  jsCallerErrorLine: number | null,
  jsCallerErrorCol: number | null,
  _callerFile: string | null,
  _callerLocation: { lineNumber?: number | null; columnNumber?: number | null } | null,
) => {
  return resolveActiveCaller(
    useExplicitCaller,
    useAutoCaller,
    jsCaller,
    jsCallerErrorLine,
    jsCallerErrorCol,
    _callerFile,
    _callerLocation
  );
};

const computeFinalPath = (
  preferCallerLocation: boolean,
  activeCaller: string | null,
  templatePath: string | null,
  _callerFile: string | null,
): string | null => {
  return preferCallerLocation
    ? activeCaller ?? templatePath ?? null
    : templatePath ?? _callerFile ?? null;
};

const resolveCallerInfo = (
  templatePath: string | null,
  jsCaller: string | null,
  jsCallerErrorLine: number | null,
  _callerFile: string | null,
  _callerLocation: { lineNumber?: number | null; columnNumber?: number | null } | null,
  jsCallerErrorCol: number | null,
) => {
  const { preferCallerLocation, useExplicitCaller, useAutoCaller } = extractCallerPreference(
    templatePath,
    jsCaller,
    jsCallerErrorLine,
    _callerFile,
    _callerLocation
  );

  const { caller: activeCaller, line: activeCallerLine, col: activeCallerCol } = extractActiveCaller(
    useExplicitCaller,
    useAutoCaller,
    jsCaller,
    jsCallerErrorLine,
    jsCallerErrorCol,
    _callerFile,
    _callerLocation
  );

  return { preferCallerLocation, activeCaller, activeCallerLine, activeCallerCol };
};

const parseLocationInputs = (inputs: LocationInputs) => {
  const {
    template = null,
    templatePath = null,
    jsCaller = null,
    jsCallerErrorLine = null,
    jsCallerErrorCol = null,
    _callerFile = null,
    _callerLocation = null,
    errLineno = null,
    errColno = null,
    lineno: configLineno = null,
    colno: configColno = null,
    subject = null,
    errLineBase = null
  } = inputs;

  return { template, templatePath, jsCaller, jsCallerErrorLine, jsCallerErrorCol, _callerFile, _callerLocation, errLineno, errColno, configLineno, configColno, subject, errLineBase };
};

const computeHasCallerLocation = (errLineno: number | null, errLineBase: string | null): { hasErrorLocation: boolean; hasCallerLocation: boolean } => {
  const hasErrorLocation = errLineno !== undefined && errLineno !== null;
  const hasCallerLocation = hasErrorLocation && errLineBase === 'one';
  return { hasErrorLocation, hasCallerLocation };
};

const resolveActiveLocationData = (inputs: LocationInputs) => {
  const { template, templatePath, jsCaller, jsCallerErrorLine, jsCallerErrorCol, _callerFile, _callerLocation, errLineno, errColno, configLineno, configColno, subject, errLineBase } = parseLocationInputs(inputs);
  const { hasErrorLocation, hasCallerLocation } = computeHasCallerLocation(errLineno, errLineBase);

  const { preferCallerLocation, activeCaller, activeCallerLine, activeCallerCol } = resolveCallerInfo(
    templatePath,
    jsCaller,
    jsCallerErrorLine,
    _callerFile,
    _callerLocation,
    jsCallerErrorCol
  );

  const finalPath = computeFinalPath(preferCallerLocation, activeCaller, templatePath, _callerFile);

  return {
    template,
    configLineno,
    configColno,
    hasErrorLocation,
    hasCallerLocation,
    preferCallerLocation,
    activeCaller,
    activeCallerLine,
    activeCallerCol,
    finalPath,
    errLineno,
    errColno,
    subject,
  };
};

const resolveLocation = async (inputs: LocationInputs): Promise<ResolvedLocation> => {
  const {
    template,
    configLineno,
    configColno,
    hasErrorLocation,
    hasCallerLocation,
    preferCallerLocation,
    activeCaller,
    activeCallerLine,
    activeCallerCol,
    finalPath,
    errLineno,
    errColno,
    subject,
  } = resolveActiveLocationData(inputs);

  const { sourceContent, sourceStartLine, resolvedCallerLine, resolvedCallerCol } = await resolveSourceContent(
    preferCallerLocation,
    hasCallerLocation,
    activeCaller,
    activeCallerLine,
    activeCallerCol,
    template,
    errLineno,
    errColno,
    subject,
  );

  const { lineno, colno, lineBase } = resolveFinalCoordinates(
    preferCallerLocation,
    hasErrorLocation,
    errLineno,
    errColno,
    resolvedCallerLine,
    resolvedCallerCol,
    configLineno,
    configColno
  );

  return buildResolvedLocation(lineno, colno, lineBase, finalPath, sourceContent, sourceStartLine, preferCallerLocation);
};

export { resolveLocation };
export type { LocationInputs, ResolvedLocation };
