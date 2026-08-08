
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

interface CallerFlags {
  useExplicitCaller: boolean;
  useAutoCaller: boolean;
  preferCallerLocation: boolean;
}

const getCallerFlags = (inputs: LocationInputs): CallerFlags => {
  const { templatePath = null, jsCaller = null, jsCallerErrorLine = null, _callerFile = null, _callerLocation = null } = inputs;
  const useExplicitCaller = jsCaller !== null && jsCallerErrorLine !== null;
  const useAutoCaller =
    !templatePath &&
    jsCaller === null &&
    _callerFile !== null &&
    _callerFile !== 'unknown' &&
    _callerLocation !== null;
  return { useExplicitCaller, useAutoCaller, preferCallerLocation: !templatePath && (useExplicitCaller || useAutoCaller) };
};

const getActiveCallerInfo = (inputs: LocationInputs, flags: CallerFlags) => {
  const { useExplicitCaller, useAutoCaller } = flags;
  const { jsCaller = null, jsCallerErrorLine = null, jsCallerErrorCol = null, _callerFile = null, _callerLocation = null } = inputs;
  const activeCaller = useExplicitCaller ? jsCaller : (useAutoCaller ? _callerFile ?? null : null);
  const activeCallerLine = useExplicitCaller ? jsCallerErrorLine : (useAutoCaller ? _callerLocation?.lineNumber ?? null : null);
  const activeCallerCol = useExplicitCaller ? jsCallerErrorCol : (useAutoCaller ? _callerLocation?.columnNumber ?? null : null);
  return { activeCaller, activeCallerLine, activeCallerCol };
};

const resolveCallerInfo = (inputs: LocationInputs): CallerInfo => {
  const {
    template = null,
    templatePath = null,
    _callerFile = null,
    errLineno = null,
    errColno = null,
    lineno: configLineno = null,
    colno: configColno = null,
    subject = null,
    errLineBase = null,
  } = inputs;

  const flags = getCallerFlags(inputs);
  const { preferCallerLocation } = flags;
  const { activeCaller, activeCallerLine, activeCallerCol } = getActiveCallerInfo(inputs, flags);

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

interface CallerFilePositionInput {
  activeCaller: string;
  template: string | null;
  errLineno: number | null;
  errColno: number | null;
  subject: string | null;
  activeCallerLine: number | null;
}

const resolveCallerFilePosition = async (
  input: CallerFilePositionInput,
): Promise<{ source: string | null; line: number | null; col: number | null }> => {
  const { activeCaller, template, errLineno, errColno, subject, activeCallerLine } = input;
  let fileContent: string | null = null;
  try {
    fileContent = await readFile(activeCaller, 'utf8');
  } catch {
    fileContent = null;
  }
  if (fileContent === null) {
    return { source: null, line: null, col: null };
  }
  const position = extractCallerPosition({ content: fileContent, template, errLineno, errColno, subject, preferredLine: activeCallerLine });
  if (!position) {
    return { source: null, line: null, col: null };
  }
  return { source: fileContent, line: position.line, col: position.col };
};

const resolveCallerContent = async (info: CallerInfo): Promise<{
  sourceContent: string | null;
  callerLine: number | null;
  callerCol: number | null;
}> => {
  const baseCallerLine = info.hasCallerLocation ? info.errLineno : info.activeCallerLine;
  const baseCallerCol = info.hasCallerLocation ? info.errColno : info.activeCallerCol;

  if (info.preferCallerLocation && info.activeCaller && !info.hasCallerLocation) {
    const { source, line, col } = await resolveCallerFilePosition({
      activeCaller: info.activeCaller, template: info.template, errLineno: info.errLineno, errColno: info.errColno, subject: info.subject, activeCallerLine: info.activeCallerLine
    });
    if (source !== null) {
      return { sourceContent: source, callerLine: line, callerCol: col };
    }
  }

  return { sourceContent: info.template, callerLine: baseCallerLine, callerCol: baseCallerCol };
};

const pickCoords = (info: CallerInfo, coords: { callerLine: number | null; callerCol: number | null }): {
  lineno: number | null;
  colno: number | null;
  lineBase: 'zero' | 'one';
} => {
  const { callerLine, callerCol } = coords;
  if (info.preferCallerLocation) {
    return {
      lineno: callerLine ?? info.configLineno ?? info.errLineno ?? null,
      colno: callerCol ?? info.configColno ?? info.errColno ?? null,
      lineBase: 'one',
    };
  }
  if (info.hasErrorLocation && info.errLineno !== null) {
    return { lineno: info.errLineno, colno: info.errColno, lineBase: 'zero' };
  }
  return { lineno: info.configLineno, colno: info.configColno, lineBase: 'zero' };
};

const resolveSourceAndCoords = async (info: CallerInfo): Promise<{
  sourceContent: string | null;
  sourceStartLine: number;
  lineno: number | null;
  colno: number | null;
  lineBase: 'zero' | 'one';
}> => {
  const { sourceContent, callerLine, callerCol } = await resolveCallerContent(info);
  const resolvedCoords = pickCoords(info, { callerLine, callerCol });
  return { sourceContent, sourceStartLine: 1, ...resolvedCoords };
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
