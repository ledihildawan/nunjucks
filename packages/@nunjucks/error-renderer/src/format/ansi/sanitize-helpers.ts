import { keys } from 'remeda';

// WHY: ANSI escape injection guard — every user-controlled string reaching the
// terminal passes through this single strip. All C0 controls except \t\n\r, DEL,
// and the C1 range (incl. 8-bit CSI \x9b) are removed so raw input cannot
// reprogram the terminal (clear screens, retitle windows, forge OSC 8 links).
// The renderer's own structured ANSI is built from constants and never passes
// through here; the strip is applied to RAW text before it gets wrapped/colored.
// biome-ignore lint/suspicious/noControlCharactersInRegex: the control-character class IS the sanitizer — matching C0/C1 ranges here is the entire point of this module.
const TERMINAL_CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0080-\u009f]/gu;

/** Strips terminal-hijacking control characters (ESC, BEL, CSI, other C0/C1) from raw text, preserving \t\n\r. */
export const sanitizeTerminalText = (text: string): string => text.replace(TERMINAL_CONTROL_RE, '');

/** Renders a primitive for ANSI display, quoting strings and naming functions. */
export const sanitizePrimitive = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }
  if (typeof value === 'string') {
    return `"${sanitizeTerminalText(value)}"`;
  }
  return String(value);
};

/**
 * Renders a context value for ANSI display without ever expanding objects: primitives go
 * through `sanitizePrimitive`, arrays collapse to `Array(n)`, objects to `Object(n)`, and
 * re-visited objects degrade to `[Circular]`.
 */
export const sanitizeForAnsi = (value: unknown, seen?: WeakSet<object>): string => {
  if (typeof value !== 'object' || value === null) {
    return sanitizePrimitive(value);
  }
  if (seen?.has(value)) {
    return '[Circular]';
  }
  const newSeen = seen ?? new WeakSet();
  newSeen.add(value);
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  return `Object(${keys(value).length})`;
};
