import { describe, test, expect } from 'bun:test';
import { compileTemplateData, compileCapture } from './index.ts';
import { templateData, output } from '@nunjucks/nodes';
import { asCompiler } from '../../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    buffer: 'output',
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'B'); },
    withScopedSyntax: (fn: () => void) => fn(),
    fail: (msg: string) => { throw new Error(msg); },
  };
};

describe('compileTemplateData', () => {
  test('emits buffer += JSON-stringified value', () => {
    const c = makeCompiler();
    compileTemplateData(asCompiler(c), templateData(0, 0, 'hi'), frame);
    expect(c.emitted.join('')).toBe('output += "hi";');
  });
});

describe('compileCapture', () => {
  test('named capture wraps in frame.set with an async IIFE', () => {
    const c = makeCompiler();
    compileCapture(asCompiler(c), {
      name: 'captured',
      body: output(0, 0, [templateData(0, 0, 'x')]),
    } as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('frame.set("captured", await (async () => {');
    expect(joined).toContain('return output;');
    expect(joined).toContain('})());');
  });

  test('anonymous capture returns the value directly', () => {
    const c = makeCompiler();
    compileCapture(asCompiler(c), {
      name: null,
      body: output(0, 0, [templateData(0, 0, 'x')]),
    } as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('(async () => {');
    expect(joined).toContain('})()');
  });
});