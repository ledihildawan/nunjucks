const STACK_LOCATION_RE = /\(([^()]+):(\d+):(\d+)\)$/u;
const STACK_FUNCTION_RE = /^at\s+([^\s]+)/u;

export interface ParsedStackFrame {
  raw: string;
  fn: string;
  path: string | null;
  line: number | null;
  col: number | null;
}

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

  return { raw: trimmed, fn, path: null, line: null, col: null };
};
