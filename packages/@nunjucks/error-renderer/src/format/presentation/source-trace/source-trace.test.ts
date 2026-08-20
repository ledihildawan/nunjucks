import { describe, expect, test } from 'bun:test';
import { buildSourceTrace } from './source-trace.ts';

describe('buildSourceTrace', () => {
  test('highlights line 2 (not line 1) for a line-2 error with lineBase zero', () => {
    const source = ['Hello {{ user.name }}!', 'Your status: {{ user["status"]() }}', ''].join('\n');
    const trace = buildSourceTrace({
      sourceContent: source,
      lineno: 1,
      colno: 22,
      lineBase: 'zero',
      sourceStartLine: 1,
    });

    const errorLine = trace.lines.find((l) => l.isError);
    expect(errorLine?.number).toBe(2);
    expect(errorLine?.content).toContain('user["status"]');
    expect(trace.caret?.line).toBe(2);
    expect(trace.caret?.charStart).toBe(22);
    expect(trace.displayLine).toBe(2);
    expect(trace.displayCol).toBe(23);
  });

  test('does not regress for a line-1 error (lineBase zero)', () => {
    const source = ['{{ missing }}', 'second line'].join('\n');
    const trace = buildSourceTrace({
      sourceContent: source,
      lineno: 0,
      colno: 3,
      lineBase: 'zero',
      sourceStartLine: 1,
    });

    const errorLine = trace.lines.find((l) => l.isError);
    expect(errorLine?.number).toBe(1);
    expect(trace.caret?.line).toBe(1);
    expect(trace.displayLine).toBe(1);
  });

  test('treats lineno as already 1-based under lineBase one', () => {
    const source = ['line one', 'line two', 'line three'].join('\n');
    const trace = buildSourceTrace({
      sourceContent: source,
      lineno: 3,
      colno: 1,
      lineBase: 'one',
      sourceStartLine: 1,
    });

    const errorLine = trace.lines.find((l) => l.isError);
    expect(errorLine?.number).toBe(3);
    expect(errorLine?.content).toBe('line three');
    expect(trace.displayLine).toBe(3);
  });

  test('returns empty lines but valid display coords when there is no source', () => {
    const trace = buildSourceTrace({
      sourceContent: null,
      templatePath: 'inline',
      lineno: 4,
      colno: 5,
      lineBase: 'zero',
    });

    expect(trace.lines).toEqual([]);
    expect(trace.caret).toBeNull();
    expect(trace.displayLine).toBe(5);
    expect(trace.displayCol).toBe(6);
  });

  test('caret snaps to the offending word, not the raw column', () => {
    const source = ['{{ user.status.value }}'].join('\n');
    const trace = buildSourceTrace({
      sourceContent: source,
      lineno: 0,
      colno: 11,
      lineBase: 'zero',
      sourceStartLine: 1,
    });

    expect(trace.caret).not.toBeNull();
    expect(trace.caret?.charStart).toBe(8);
    expect(trace.caret?.carets).toBe('^^^^^^');
  });

  test('caret padding uses display cells while offsets stay code-unit based', () => {
    const trace = buildSourceTrace({
      sourceContent: 'エラー: {{ user.status }}',
      lineno: 0,
      colno: 8,
      lineBase: 'zero',
      sourceStartLine: 1,
    });

    // WHY: 'user' starts at code-unit 8, but 'エラー: {{ ' renders 11 cells wide
    // (three 2-cell kana) — renderers must pad with displayStart, not charStart.
    expect(trace.caret?.charStart).toBe(8);
    expect(trace.caret?.displayStart).toBe(11);
    expect(trace.caret?.carets).toBe('^^^^');
  });

  test('resolves templatePath as resolvedPath when source content is present', () => {
    const trace = buildSourceTrace({
      sourceContent: 'line one\nline two',
      templatePath: 'inline',
      lineno: 0,
      colno: 0,
      lineBase: 'zero',
      sourceStartLine: 1,
    });

    expect(trace.resolvedPath).toBe('inline');
    expect(trace.lines.length).toBeGreaterThan(0);
  });
});
