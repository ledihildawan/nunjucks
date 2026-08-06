/**
 * Line-numbering base: `'zero'` (0-indexed, internal) or `'one'` (1-indexed, display).
 *
 * Foundational type used across the log package (error creation, diagnostics,
 * warnings, and rendering). Lives here — not inside `render/internal/` — so
 * that non-render modules (create-log, diagnostics, warning) don't have to
 * reach into the renderer's internal layer.
 */
export type LineBase = 'zero' | 'one';

export const normalizeLineBase = (lineBase?: LineBase | null): LineBase =>
  lineBase === 'one' ? 'one' : 'zero';
