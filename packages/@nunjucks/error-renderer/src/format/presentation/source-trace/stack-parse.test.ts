import { describe, expect, test } from 'bun:test';
import { parseStackFrame } from './stack-parse.ts';

describe('parseStackFrame', () => {
  test('parses a V8 frame with a named function', () => {
    const v8StackFrame = '    at Foo (file.ts:10:20)';
    expect(parseStackFrame(v8StackFrame)).toEqual({
      raw: 'at Foo (file.ts:10:20)',
      fn: 'Foo',
      path: 'file.ts',
      line: 10,
      col: 20,
    });
  });

  test('parses an Object.<anonymous> frame keeping the dotted callee', () => {
    const anonymousFrame = '    at Object.<anonymous> (app.js:1:5)';
    expect(parseStackFrame(anonymousFrame)).toEqual({
      raw: 'at Object.<anonymous> (app.js:1:5)',
      fn: 'Object.<anonymous>',
      path: 'app.js',
      line: 1,
      col: 5,
    });
  });

  test('parses a windows drive path inside the location group', () => {
    const windowsFrame = '    at Foo (C:\\src\\app.ts:42:7)';
    expect(parseStackFrame(windowsFrame)).toEqual({
      raw: 'at Foo (C:\\src\\app.ts:42:7)',
      fn: 'Foo',
      path: 'C:\\src\\app.ts',
      line: 42,
      col: 7,
    });
  });

  test('parses a posix absolute path with multiple colons', () => {
    const posixFrame = '    at run (/usr/local/bin/run.js:100:25)';
    const parsed = parseStackFrame(posixFrame);
    expect(parsed.path).toBe('/usr/local/bin/run.js');
    expect(parsed.line).toBe(100);
    expect(parsed.col).toBe(25);
  });

  test('parses an anonymous bare frame without parentheses', () => {
    // WHY: regression pin — anonymous frames used to yield path:null because only
    // the parenthesised form was recognised.
    const bareFrame = '    at file.ts:10:20';
    const parsed = parseStackFrame(bareFrame);
    expect(parsed.raw).toBe('at file.ts:10:20');
    expect(parsed.fn).toBe('');
    expect(parsed.path).toBe('file.ts');
    expect(parsed.line).toBe(10);
    expect(parsed.col).toBe(20);
  });

  test('parses an anonymous frame with a posix absolute path', () => {
    const parsed = parseStackFrame('    at /srv/app/dist/index.js:4:19');
    expect(parsed.fn).toBe('');
    expect(parsed.path).toBe('/srv/app/dist/index.js');
    expect(parsed.line).toBe(4);
    expect(parsed.col).toBe(19);
  });

  test('parses an anonymous frame with a file:// URL and drive colon', () => {
    const parsed = parseStackFrame('    at file:///C:/src/app.ts:42:7');
    expect(parsed.fn).toBe('');
    expect(parsed.path).toBe('file:///C:/src/app.ts');
    expect(parsed.line).toBe(42);
    expect(parsed.col).toBe(7);
  });

  test('falls back for an unparseable string with no frame markers', () => {
    const unparseableInput = 'not a stack frame at all';
    expect(parseStackFrame(unparseableInput)).toEqual({
      raw: 'not a stack frame at all',
      fn: '',
      path: null,
      line: null,
      col: null,
    });
  });

  test('returns an empty function name when the frame has no "at " prefix', () => {
    const locationOnly = '(file.ts:1:2)';
    const parsed = parseStackFrame(locationOnly);
    expect(parsed.fn).toBe('');
    expect(parsed.path).toBe('file.ts');
    expect(parsed.line).toBe(1);
    expect(parsed.col).toBe(2);
  });

  test('trims surrounding whitespace before matching', () => {
    const paddedFrame = '   at Foo (file.ts:1:1)   ';
    const parsed = parseStackFrame(paddedFrame);
    expect(parsed.raw).toBe('at Foo (file.ts:1:1)');
    expect(parsed.fn).toBe('Foo');
  });

  test('falls back when the location group is missing column digits', () => {
    const noColFrame = '    at Foo (file.ts:10)';
    const parsed = parseStackFrame(noColFrame);
    expect(parsed.fn).toBe('Foo');
    expect(parsed.path).toBeNull();
    expect(parsed.line).toBeNull();
    expect(parsed.col).toBeNull();
  });

  test('parses line and col values as real numbers', () => {
    const parsed = parseStackFrame('at Foo (f.js:12:34)');
    expect(parsed.line).toBe(12);
    expect(parsed.col).toBe(34);
    expect(typeof parsed.line).toBe('number');
    expect(typeof parsed.col).toBe('number');
  });
});
