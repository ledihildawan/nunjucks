const STACK_LOCATION_RE = /\(([^()]+):(\d+):(\d+)\)$/u;
const STACK_FUNCTION_RE = /^at\s+([^\s]+)/u;
// WHY: anonymous frames (`at /path/file.js:10:15`, `at file:///...`) carry the
// location bare, without parentheses — the path is greedy up to the last :line:col.
const STACK_ANONYMOUS_RE = /^at\s+(.+):(\d+):(\d+)$/u;

interface ParsedStackFrame {
  raw: string;
  fn: string;
  path: string | null;
  line: number | null;
  col: number | null;
}

/**
 * Parses a single V8 stack frame into its callee, path, and 1-based position;
 * unparseable frames degrade to a fallback with `null` path and coordinates.
 */
export const parseStackFrame = (line: string): ParsedStackFrame => {
  const trimmed = line.trim();
  const pathMatch = trimmed.match(STACK_LOCATION_RE);
  const fnMatch = trimmed.match(STACK_FUNCTION_RE);
  const fn = fnMatch?.[1] ?? '';

  if (pathMatch?.[1] && pathMatch[2]) {
    return {
      raw: trimmed,
      fn,
      path: pathMatch[1],
      line: Number.parseInt(pathMatch[2], 10),
      col: pathMatch[3] ? Number.parseInt(pathMatch[3], 10) : null,
    };
  }

  const anonMatch = trimmed.match(STACK_ANONYMOUS_RE);
  if (anonMatch?.[1] && anonMatch[2]) {
    return {
      raw: trimmed,
      fn: '',
      path: anonMatch[1],
      line: Number.parseInt(anonMatch[2], 10),
      col: anonMatch[3] ? Number.parseInt(anonMatch[3], 10) : null,
    };
  }

  return { raw: trimmed, fn, path: null, line: null, col: null };
};
