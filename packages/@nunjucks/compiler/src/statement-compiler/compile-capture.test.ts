import { describe, test, expect } from 'bun:test';
import { compileCapture } from './compile-capture.ts';
import { capture, output, templateData } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { ZERO_LOC } from '@nunjucks/shared';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  const bufferAtCompile: string[] = [];
  let buffer = 'main';
  return {
    emitted,
    bufferAtCompile,
    get buffer() { return buffer; },
    set buffer(nextBuffer: string) { buffer = nextBuffer; },
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    compile: (node: { mock?: string }) => {
      bufferAtCompile.push(buffer);
      emitted.push(node.mock ?? 'BODY');
    },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

describe('compileCapture', () => {
  test('named capture wraps the body in frame.set + an awaited async IIFE', () => {
    const c = makeCompiler();
    const namedCapture = capture(ZERO_LOC, {
      name: 'captured',
      body: output(ZERO_LOC, [templateData(ZERO_LOC, 'x')]),
    });
    compileCapture(asCompiler(c), { node: namedCapture, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('frame = frame.set("captured", await (async () => {');
    expect(joined).toContain('let output = "";');
    expect(joined).toContain('return output;');
    expect(joined).toContain('})());');
  });

  test('anonymous capture emits a bare async IIFE with no frame.set wrap', () => {
    const c = makeCompiler();
    const anonymousCapture = capture(ZERO_LOC, {
      body: output(ZERO_LOC, [templateData(ZERO_LOC, 'x')]),
    });
    compileCapture(asCompiler(c), { node: anonymousCapture, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('(async () => {');
    expect(joined).toContain('})()');
    expect(joined).not.toContain('frame = frame.set(');
    expect(joined).not.toContain('})());');
  });

  describe('buffer swap', () => {
    const bufferCases: ReadonlyArray<{ label: string; name: string | null; terminator: string }> = [
      { label: 'named capture swaps to "output" during the body then restores the original buffer', name: 'captured', terminator: '})());' },
      { label: 'anonymous capture swaps to "output" during the body then restores the original buffer', name: null, terminator: '})()' },
    ];
    bufferCases.forEach(({ label, name, terminator }) => {
      test(label, () => {
        const c = makeCompiler();
        const captureNode = capture(ZERO_LOC, { name, body: output(ZERO_LOC, []) });
        compileCapture(asCompiler(c), { node: captureNode, frame });
        expect(c.bufferAtCompile[0]).toBe('output');
        expect(c.buffer).toBe('main');
        expect(c.emitted.join('')).toContain(terminator);
      });
    });
  });
});
