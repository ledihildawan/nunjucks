interface LocationInputs {
  template?: string | null;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  callerFile?: string | null;
  callerLocation?: { lineNumber?: number | null; columnNumber?: number | null } | null;
  errLineno?: number | null;
  errColno?: number | null;
  errLineBase?: 'zero' | 'one' | null;
  lineno?: number | null;
  colno?: number | null;
  subject?: string | null;
}

interface ResolvedLocation {
  lineno: number | null;
  colno: number | null;
  lineBase: 'zero' | 'one';
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  preferCallerLocation: boolean;
}

interface SourcePosition {
  line: number;
  col: number;
}

interface TemplateMatch {
  index: number;
  template: string;
}

export type { LocationInputs, ResolvedLocation, SourcePosition, TemplateMatch };
