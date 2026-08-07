
import { readFile } from 'node:fs/promises';

import { extractCallerPosition } from './error-location-matching.ts';
import type { LocationInputs, ResolvedLocation } from './error-location-types.ts';

interface CallerInfo {
  template: string | null;
  subject: string | null;
  configLineno: number | null;
  configColno: number | null;
  errLineno: number | null;
  errColno: number | null;
  hasErrorLocation: boolean;
  hasCallerLocation: boolean;
  preferCallerLocation: boolean;
  activeCaller: string | null;
  activeCallerLine: number | null;
  activeCallerCol: number | null;
  finalPath: string | null;
}

const getCallerFlags = (
  templatePath: string | null,
  jsCaller: string | null,
  jsCallerErrorLine: number | null,
  _callerFile: string | null,
  _callerLocation: { lineNumber?: number | null; columnNumber?: number | null } | null,
) => {
  const useExplicitCaller = jsCaller !== null && jsCallerErrorLine !== null;
  const useAutoCaller =
    !templatePath &&
    jsCaller === null &&
    _callerFile !== null &&
    _callerFile !== 'unknown' &&
    _callerLocation !== null;
  return { useExplicitCaller, useAutoCaller, preferCallerLocation: !templatePath && (useExplicitCaller || useAutoCaller) };
};

const getActiveCallerInfo = (
  useExplicitCaller: boolean,
  useAutoCaller: boolean,
  jsCaller: string | null,
  jsCallerErrorLine: number | null,
  jsCallerErrorCol: number | null,
  _callerFile: string | null,
  _callerLocation: { lineNumber?: number | null; columnNumber?: number | null } | null,
) => {
  const activeCaller = useExplicitCaller ? jsCaller : (useAutoCaller ? _callerFile ?? null : null);
  const activeCallerLine = useExplicitCaller ? jsCallerErrorLine : (useAutoCaller ? _callerLocation?.lineNumber ?? null : null);
  const activeCallerCol = useExplicitCaller ? jsCallerErrorCol : (useAutoCaller ? _callerLocation?.columnNumber ?? null : null);
  return { activeCaller, activeCallerLine, activeCallerCol };
};

const resolveCallerInfo = (inputs: LocationInputs): CallerInfo => {
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
    errLineBase = null,
  } = inputs;

  const { useExplicitCaller, useAutoCaller, preferCallerLocation } = getCallerFlags(
    templatePath, jsCaller, jsCallerErrorLine, _callerFile, _callerLocation
  );
  const { activeCaller, activeCallerLine, activeCallerCol } = getActiveCallerInfo(
    useExplicitCaller, useAutoCaller, jsCaller, jsCallerErrorLine, jsCallerErrorCol, _callerFile, _callerLocation
  );

  const hasErrorLocation = errLineno !== null;
  const hasCallerLocation = hasErrorLocation && errLineBase === 'one';
  const finalPath = preferCallerLocation
    ? activeCaller ?? templatePath ?? null
    : templatePath ?? _callerFile ?? null;

  return {
    template, subject, configLineno, configColno, errLineno, errColno,
    hasErrorLocation, hasCallerLocation, preferCallerLocation,
    activeCaller, activeCallerLine, activeCallerCol, finalPath,
  };
};

const resolveCallerFilePosition = async (
  activeCaller: string,
  template: string | null,
  errLineno: number | null,
  errColno: number | null,
  subject: string | null,
  activeCallerLine: number | null,
): Promise<{ source: string | null; line: number | null; col: number | null }> => {
  let fileContent: string | null = null;
  try {
    fileContent = await readFile(activeCaller, 'utf8');
  } catch {
    fileContent = null;
  }
  if (fileContent === null) {
    return { source: null, line: null, col: null };
  }
  const position = extractCallerPosition(fileContent, template, errLineno, errColno, subject, activeCallerLine);
  if (!position) {
    return { source: null, line: null, col: null };
  }
  return { source: fileContent, line: position.line, col: position.col };
};

const resolveSourceAndCoords = async (
  info: CallerInfo
): Promise<{ sourceContent: string | null; sourceStartLine: number; lineno: number | null; colno: number | null; lineBase: 'zero' | 'one' }> => {
  const {
    template, subject, configLineno, configColno, errLineno, errColno,
    hasErrorLocation, hasCallerLocation, preferCallerLocation,
    activeCaller, activeCallerLine, activeCallerCol,
  } = info;

  const baseResolvedCallerLine = hasCallerLocation ? errLineno : activeCallerLine;
  const baseResolvedCallerCol = hasCallerLocation ? errColno : activeCallerCol;
  let sourceContent = template;
  let resolvedCallerLine = baseResolvedCallerLine;
  let resolvedCallerCol = baseResolvedCallerCol;

  if (preferCallerLocation && activeCaller && !hasCallerLocation) {
    const { source, line, col } = await resolveCallerFilePosition(activeCaller, template, errLineno, errColno, subject, activeCallerLine);
    if (source !== null) {
      sourceContent = source;
      resolvedCallerLine = line;
      resolvedCallerCol = col;
    }
  }

  let lineno: number | null;
  let colno: number | null;
  let lineBase: 'zero' | 'one';
  if (preferCallerLocation) {
    lineno = resolvedCallerLine ?? configLineno ?? errLineno ?? null;
    colno = resolvedCallerCol ?? configColno ?? errColno ?? null;
    lineBase = 'one';
  } else if (hasErrorLocation && errLineno !== null) {
    lineno = errLineno;
    colno = errColno;
    lineBase = 'zero';
  } else {
    lineno = configLineno;
    colno = configColno;
    lineBase = 'zero';
  }

  return { sourceContent, sourceStartLine: 1, lineno, colno, lineBase };
};

const resolveLocation = async (inputs: LocationInputs): Promise<ResolvedLocation> => {
  const info = resolveCallerInfo(inputs);
  const { sourceContent, sourceStartLine, lineno, colno, lineBase } = await resolveSourceAndCoords(info);
  return {
    lineno,
    colno,
    lineBase,
    templatePath: info.finalPath,
    sourceContent,
    sourceStartLine,
    preferCallerLocation: info.preferCallerLocation,
  };
};

export { resolveLocation };
export type { LocationInputs, ResolvedLocation };
