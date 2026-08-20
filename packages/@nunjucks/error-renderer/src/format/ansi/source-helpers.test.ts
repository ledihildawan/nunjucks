import { describe, expect, test } from 'bun:test';
import { buildSourceTrace } from '../presentation/source-trace/source-trace.ts';
import { formatSourceTrace } from './source-helpers.ts';

// WHY: built via the constructor so the SGR strip pattern carries no literal
// control character (biome bans control characters in regex literals).
const ANSI_SGR_RE = new RegExp('\u001b' + '\\[[0-9;]*m', 'g');

const lastLine = (lines: string[]): string =>
  (lines[lines.length - 1] ?? '').replace(ANSI_SGR_RE, '');

describe('formatSourceTrace', () => {
  test('pads the caret line by display width so it lands under a CJK token', () => {
    const trace = buildSourceTrace({
      sourceContent: 'エラー: {{ user.status }}',
      lineno: 0,
      colno: 8,
      lineBase: 'zero',
      sourceStartLine: 1,
    });
    const rendered = formatSourceTrace(trace.lines, trace.caret);
    // WHY: 'エラー: {{ ' is 10 code units but 11 cells (three wide kana) — the
    // caret padding must be cell-based or it underlines the wrong column.
    expect(lastLine(rendered)).toContain(`${' '.repeat(11)}^^^^`);
  });

  test('ASCII caret padding is unchanged', () => {
    const trace = buildSourceTrace({
      sourceContent: '{{ user.status }}',
      lineno: 0,
      colno: 3,
      lineBase: 'zero',
      sourceStartLine: 1,
    });
    const rendered = formatSourceTrace(trace.lines, trace.caret);
    expect(lastLine(rendered)).toContain(`${' '.repeat(3)}^^^^`);
  });
});
