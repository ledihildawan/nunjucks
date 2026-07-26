import { describe, test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { getErrorMetadata } from './internal/metadata-extras.ts';
import { buildSourceTrace, resolveSourceContent } from './internal/source-trace.ts';

const testFilePath = fileURLToPath(import.meta.url);

// Direct tests for the canonical source-trace builder. These guard the line
// math, caret anchoring, and source-content resolution that every presenter
// (HTML/ANSI/metadata) now shares — so a regression here is caught once instead
// of three times.
describe('buildSourceTrace', () => {
  test('highlights line 2 (not line 1) for a line-2 error with lineBase zero', async () => {
    const source = ['Hello {{ user.name }}!', 'Your status: {{ user["status"]() }}', ''].join('\n');
    const trace = await buildSourceTrace({
      sourceContent: source,
      lineno: 1, // 0-based -> absolute line 2
      colno: 22, // 0-based -> col 23 (the 's' of "status")
      lineBase: 'zero',
      sourceStartLine: 1
    });

    const errorLine = trace.lines.find((l) => l.isError);
    expect(errorLine?.number).toBe(2);
    expect(errorLine?.content).toContain('user["status"]');
    // Caret must anchor on line 2 under the "status" token, not on line 1.
    expect(trace.caret?.line).toBe(2);
    expect(trace.caret?.charStart).toBe(22);
    // displayLine is 1-based absolute.
    expect(trace.displayLine).toBe(2);
    expect(trace.displayCol).toBe(23);
  });

  test('does not regress for a line-1 error (lineBase zero)', async () => {
    const source = ['{{ missing }}', 'second line'].join('\n');
    const trace = await buildSourceTrace({
      sourceContent: source,
      lineno: 0,
      colno: 3,
      lineBase: 'zero',
      sourceStartLine: 1
    });

    const errorLine = trace.lines.find((l) => l.isError);
    expect(errorLine?.number).toBe(1);
    expect(trace.caret?.line).toBe(1);
    expect(trace.displayLine).toBe(1);
  });

  test('treats lineno as already 1-based under lineBase one', async () => {
    const source = ['line one', 'line two', 'line three'].join('\n');
    const trace = await buildSourceTrace({
      sourceContent: source,
      lineno: 3, // already 1-based
      colno: 1,
      lineBase: 'one',
      sourceStartLine: 1
    });

    const errorLine = trace.lines.find((l) => l.isError);
    expect(errorLine?.number).toBe(3);
    expect(errorLine?.content).toBe('line three');
    expect(trace.displayLine).toBe(3);
  });

  test('returns empty lines but valid display coords when there is no source', async () => {
    const trace = await buildSourceTrace({
      sourceContent: null,
      templatePath: 'inline',
      lineno: 4,
      colno: 5,
      lineBase: 'zero'
    });

    expect(trace.lines).toEqual([]);
    expect(trace.caret).toBeNull();
    // Coords are still resolved for the location link.
    expect(trace.displayLine).toBe(5);
    expect(trace.displayCol).toBe(6);
  });

  test('caret snaps to the offending word, not the raw column', async () => {
    // Error col lands mid-token on "status"; the caret should start at the token.
    const source = ['{{ user.status.value }}'].join('\n');
    const trace = await buildSourceTrace({
      sourceContent: source,
      lineno: 0,
      colno: 11, // 0-based -> col 12 (inside "status")
      lineBase: 'zero',
      sourceStartLine: 1
    });

    expect(trace.caret).not.toBeNull();
    expect(trace.caret?.charStart).toBe(8); // start of "status"
    expect(trace.caret?.carets).toBe('^^^^^^');
  });

  test('reads the full caller file for a caller-coord error (lineBase one)', async () => {
    // A caller-coord error (inline render() in a script) carries the inline
    // template string as sourceContent, but the lineno refers to the caller
    // file — so the builder must read the WHOLE caller file, not the string.
    const { content, resolvedPath } = await resolveSourceContent(
      '{{ x }}',
      testFilePath,
      'one'
    );
    expect(content).not.toBe('{{ x }}');
    expect(content).toContain('buildSourceTrace');
    expect(resolvedPath).toBe(testFilePath);

    // And a trace built from it windows around a real line of that file.
    const trace = await buildSourceTrace({
      sourceContent: '{{ x }}',
      templatePath: testFilePath,
      lineno: 1,
      colno: 1,
      lineBase: 'one',
      sourceStartLine: 1
    });
    expect(trace.lines.length).toBeGreaterThan(0);
    expect(trace.resolvedPath).toBe(testFilePath);
  });

  test('uses sourceContent verbatim for a template-coord error (lineBase zero)', async () => {
    // Template coords: lineno indexes into sourceContent, so it must be used
    // as-is even when templatePath is a script file.
    const { content } = await resolveSourceContent(
      'line one\nline two',
      testFilePath,
      'zero'
    );
    expect(content).toBe('line one\nline two');
  });

  test('reads a file from templatePath when sourceContent is absent', async () => {
    const trace = await buildSourceTrace({
      sourceContent: null,
      templatePath: testFilePath,
      lineno: 1,
      colno: 1,
      lineBase: 'one',
      sourceStartLine: 1
    });
    expect(trace.lines.length).toBeGreaterThan(0);
    expect(trace.resolvedPath).toBe(testFilePath);
  });
});

// Regression coverage for the public getErrorMetadata wrapper, which now
// delegates its snippet/caret to buildSourceTrace. A prior off-by-one (indexing
// the snippet with the 0-based lineno instead of the 1-based display line) made
// every error past line 1 highlight the line ABOVE the real one.
describe('getErrorMetadata snippet highlighting', () => {
  test('highlights line 2 (not line 1) for a line-2 error with lineBase zero', () => {
    const source = ['Hello {{ user.name }}!', 'Your status: {{ user["status"]() }}', ''].join('\n');
    const meta = getErrorMetadata({
      code: 'NOT_A_FUNCTION',
      message: 'value is not a function',
      lineno: 1, // 0-based -> absolute line 2
      colno: 22, // 0-based -> col 23 (the 's' of "status")
      lineBase: 'zero',
      sourceContent: source,
      sourceStartLine: 1
    });

    const errorLine = meta.snippetLines.find((l) => l.isError);
    expect(errorLine?.number).toBe(2);
    expect(errorLine?.content).toContain('user["status"]');
    // Caret must anchor on line 2 under the "status" token, not on line 1.
    expect(meta.caret?.line).toBe(2);
    expect(meta.caret?.charStart).toBe(22);
  });

  test('does not regress for a line-1 error', () => {
    const source = ['{{ missing }}', 'second line'].join('\n');
    const meta = getErrorMetadata({
      code: 'UNDEFINED_VARIABLE',
      message: 'missing is not defined',
      lineno: 0,
      colno: 3,
      lineBase: 'zero',
      sourceContent: source,
      sourceStartLine: 1
    });

    const errorLine = meta.snippetLines.find((l) => l.isError);
    expect(errorLine?.number).toBe(1);
    expect(meta.caret?.line).toBe(1);
  });
});
