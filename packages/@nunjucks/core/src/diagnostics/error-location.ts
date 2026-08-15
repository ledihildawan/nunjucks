import { readFile } from 'node:fs/promises';

import { reduce } from 'remeda';
import {
  extractBareSubjectPosition,
  extractQuotedSubjectPosition,
  extractTemplatePosition,
} from './error-location-matching.ts';
import type { CallerLocation, LocationInputs, ResolvedLocation } from './error-location-types.ts';

interface CallerCandidate {
  fileName: string;
  lineNumber: number | null;
  columnNumber: number | null;
}

interface CallerSearchInput {
  template: string | null;
  errLineno: number | null;
  errColno: number | null;
  subject: string | null;
}

interface CandidateMatch {
  source: string;
  line: number;
  col: number;
  filePath: string;
}

type CallerSearchOutcome =
  | { status: 'matched'; match: CandidateMatch }
  | { status: 'unreadable'; candidate: CallerCandidate }
  | { status: 'not-found' };

const callerCandidateFromFrame = (frame: CallerLocation): CallerCandidate => ({
  fileName: frame.fileName,
  lineNumber: frame.lineNumber,
  columnNumber: frame.columnNumber,
});

const buildCallerCandidates = (inputs: LocationInputs): CallerCandidate[] => {
  const {
    jsCaller = null,
    jsCallerErrorLine = null,
    jsCallerErrorCol = null,
    callerFrames = null,
    callerFile = null,
    callerLocation = null,
  } = inputs;
  const explicitCaller =
    jsCaller !== null
      ? [{ fileName: jsCaller, lineNumber: jsCallerErrorLine, columnNumber: jsCallerErrorCol }]
      : [];
  const autoCallers =
    callerFrames && callerFrames.length > 0
      ? callerFrames.map(callerCandidateFromFrame)
      : callerFile !== null && callerFile !== 'unknown' && callerLocation !== null
        ? [
            {
              fileName: callerFile,
              lineNumber: callerLocation.lineNumber ?? null,
              columnNumber: callerLocation.columnNumber ?? null,
            },
          ]
        : [];
  return [...explicitCaller, ...autoCallers];
};

const hasAutoCaller = (inputs: LocationInputs): boolean => {
  const { jsCaller = null, callerFrames = null, callerFile = null, callerLocation = null } = inputs;
  if (jsCaller !== null) {
    return false;
  }
  if (callerFrames && callerFrames.length > 0) {
    return true;
  }
  return callerFile !== null && callerFile !== 'unknown' && callerLocation !== null;
};

const resolvePreferCallerLocation = (inputs: LocationInputs): boolean => {
  const { templatePath = null, jsCaller = null, jsCallerErrorLine = null } = inputs;
  if (templatePath) {
    return false;
  }
  const useExplicitCaller = jsCaller !== null && jsCallerErrorLine !== null;
  return useExplicitCaller || hasAutoCaller(inputs);
};

interface CandidateRead {
  candidate: CallerCandidate;
  content: string | null;
}

const readCandidateContents = (candidates: readonly CallerCandidate[]): Promise<CandidateRead[]> =>
  Promise.all(
    candidates.map(async (candidate) => {
      try {
        const content = await readFile(candidate.fileName, 'utf8');
        return { candidate, content };
      } catch {
        return { candidate, content: null };
      }
    })
  );

const INITIAL_SEARCH_OUTCOME: CallerSearchOutcome = { status: 'not-found' };

type PositionExtractor = (input: {
  content: string;
  template: string | null;
  errLineno: number | null;
  errColno: number | null;
  subject: string | null;
  preferredLine: number | null;
}) => { line: number; col: number } | null;

// WHY: multi-pass search ensures high-confidence matches (template literal, then quoted property key) are found across ALL candidate files before falling back to low-confidence bare-word matching. This prevents a reserved-word subject like 'if' from matching a TypeScript `if` keyword in an intermediate wrapper file when a later candidate file contains the actual quoted 'if' filter key.
interface SearchPassOptions {
  reads: readonly CandidateRead[];
  searchInput: CallerSearchInput;
  extractFn: PositionExtractor;
}

const searchPass = ({ reads, searchInput, extractFn }: SearchPassOptions): CallerSearchOutcome =>
  reduce(
    reads,
    (outcome: CallerSearchOutcome, { candidate, content }: CandidateRead) => {
      if (outcome.status === 'matched') {
        return outcome;
      }
      if (content === null) {
        return outcome.status === 'unreadable' ? outcome : { status: 'unreadable', candidate };
      }
      const position = extractFn({
        content,
        template: searchInput.template,
        errLineno: searchInput.errLineno,
        errColno: searchInput.errColno,
        subject: searchInput.subject,
        preferredLine: candidate.lineNumber,
      });
      if (position) {
        return {
          status: 'matched',
          match: {
            source: content,
            line: position.line,
            col: position.col,
            filePath: candidate.fileName,
          },
        };
      }
      return outcome;
    },
    INITIAL_SEARCH_OUTCOME
  );

const firstNonNotFound = (...outcomes: CallerSearchOutcome[]): CallerSearchOutcome =>
  outcomes.find((o) => o.status !== 'not-found') ?? INITIAL_SEARCH_OUTCOME;

const foldCandidateSearch = (
  reads: readonly CandidateRead[],
  searchInput: CallerSearchInput
): CallerSearchOutcome => {
  const templateOutcome = searchPass({ reads, searchInput, extractFn: extractTemplatePosition });
  if (templateOutcome.status === 'matched') {
    return templateOutcome;
  }

  const quotedOutcome = searchPass({ reads, searchInput, extractFn: extractQuotedSubjectPosition });
  if (quotedOutcome.status === 'matched') {
    return quotedOutcome;
  }

  const bareOutcome = searchPass({ reads, searchInput, extractFn: extractBareSubjectPosition });
  if (bareOutcome.status === 'matched') {
    return bareOutcome;
  }

  return firstNonNotFound(templateOutcome, quotedOutcome, bareOutcome);
};

const resolveCallerLocation = async (
  inputs: LocationInputs,
  candidates: readonly CallerCandidate[]
): Promise<ResolvedLocation | null> => {
  if (candidates.length === 0) {
    return null;
  }
  const reads = await readCandidateContents(candidates);
  const outcome = foldCandidateSearch(reads, {
    template: inputs.template ?? null,
    errLineno: inputs.errLineno ?? null,
    errColno: inputs.errColno ?? null,
    subject: inputs.subject ?? null,
  });

  if (outcome.status === 'matched') {
    return {
      sourceContent: outcome.match.source,
      sourceStartLine: 1,
      lineno: outcome.match.line,
      colno: outcome.match.col,
      lineBase: 'one',
      templatePath: outcome.match.filePath,
      preferCallerLocation: true,
    };
  }
  if (outcome.status === 'unreadable') {
    // WHY: every candidate file was unreadable (e.g. virtual/non-existent paths), so the template literal could not be verified against any of them. Preserve the first unreadable candidate's coords for the location display rather than discarding them.
    return {
      sourceContent: inputs.template ?? null,
      sourceStartLine: 1,
      lineno: outcome.candidate.lineNumber,
      colno: outcome.candidate.columnNumber,
      lineBase: 'one',
      templatePath: outcome.candidate.fileName,
      preferCallerLocation: true,
    };
  }
  // WHY: 'not-found' — all readable candidate files lack the template literal, and there is nowhere else to look. Fall back to the template's own coords.
  return null;
};

const resolveTemplateLocation = (inputs: LocationInputs): ResolvedLocation => {
  const errLineno = inputs.errLineno ?? null;
  const errLineBase = inputs.errLineBase ?? null;
  const hasErrorLocation = errLineno !== null;
  const hasCallerLocation = hasErrorLocation && errLineBase === 'one';
  if (hasErrorLocation) {
    const lineBase = hasCallerLocation ? 'one' : 'zero';
    return {
      sourceContent: inputs.template ?? null,
      sourceStartLine: 1,
      lineno: errLineno,
      colno: inputs.errColno ?? null,
      lineBase,
      templatePath: inputs.templatePath ?? null,
      preferCallerLocation: false,
    };
  }
  return {
    sourceContent: inputs.template ?? null,
    sourceStartLine: 1,
    lineno: inputs.lineno ?? null,
    colno: inputs.colno ?? null,
    lineBase: 'zero',
    templatePath: inputs.templatePath ?? null,
    preferCallerLocation: false,
  };
};

const resolveLocation = async (inputs: LocationInputs): Promise<ResolvedLocation> => {
  if (resolvePreferCallerLocation(inputs)) {
    const candidates = buildCallerCandidates(inputs);
    const callerResolved = await resolveCallerLocation(inputs, candidates);
    if (callerResolved) {
      return callerResolved;
    }
  }
  return resolveTemplateLocation(inputs);
};

export type { CallerLocation, LocationInputs, ResolvedLocation };
export { resolveLocation };
