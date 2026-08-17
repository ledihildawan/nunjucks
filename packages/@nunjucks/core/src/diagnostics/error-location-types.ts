/** A single caller stack frame — file plus line/column, either possibly null. */
interface CallerLocation {
  fileName: string;
  lineNumber: number | null;
  columnNumber: number | null;
}

/** Inputs to `resolveLocation` — template, caller hints, and error coordinates. */
interface LocationInputs {
  template?: string | null;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  callerFile?: string | null;
  callerLocation?: { lineNumber?: number | null; columnNumber?: number | null } | null;
  callerFrames?: readonly CallerLocation[] | null;
  errLineno?: number | null;
  errColno?: number | null;
  errLineBase?: 'zero' | 'one' | null;
  lineno?: number | null;
  colno?: number | null;
  subject?: string | null;
}

/** Fully-resolved error location — coordinates, `lineBase`, source, and caller preference. */
interface ResolvedLocation {
  lineno: number | null;
  colno: number | null;
  lineBase: 'zero' | 'one';
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  preferCallerLocation: boolean;
}

/** A 1-based line/column pair within a source file. */
interface SourcePosition {
  line: number;
  col: number;
}

/** A located template occurrence — offset into the caller content plus the matched candidate. */
interface TemplateMatch {
  index: number;
  template: string;
}

export type { CallerLocation, LocationInputs, ResolvedLocation, SourcePosition, TemplateMatch };
