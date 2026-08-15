import { describe, expect, test } from 'bun:test';
import { output, symbol, templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileOutput } from './compile-output.ts';

const frame = createFrame();

const makeCompiler = ({ streamErrorRecovery = false }: { streamErrorRecovery?: boolean } = {}) => {
  const emitted: string[] = [];
  const streamCatches: string[] = [];
  return {
    emitted,
    streamCatches,
    buffer: 'output',
    streamErrorRecovery,
    undefinedMode: null,
    emit: (s: string) => {
      emitted.push(s);
    },
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
    compile: (n: { mock?: string }) => {
      emitted.push(n.mock ?? 'CHILD');
    },
    getHtmlContext: (lineno: number, colno: number) => `ctx:${lineno}:${colno}`,
    emitStreamCatch: (lineno: number, colno: number) => {
      streamCatches.push(`catch(${lineno},${colno})`);
    },
  };
};

describe('compileOutput', () => {
  test('emits a JSON-stringified append for static template data', () => {
    const c = makeCompiler();
    compileOutput(asCompiler(c), { node: output(ZERO_LOC, [templateData(ZERO_LOC, 'hi')]), frame });
    expect(c.emitted.join('')).toBe('output += "hi";\n');
  });

  test('wraps expression children in suppressValue(awaitValue(ensureDefined(...)))', () => {
    const c = makeCompiler();
    compileOutput(asCompiler(c), { node: output(ZERO_LOC, [symbol(ZERO_LOC, 'x')]), frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('lineno = 0; colno = 0; output += runtime.suppressValue(');
    expect(joined).toContain('await runtime.awaitValue(');
    expect(joined).toContain('runtime.ensureDefined(');
    expect(joined).toContain('CHILD');
    expect(joined).toContain(', { lineno: 0, colno: 0, varName: "x" })');
    expect(joined).toContain(', { autoescape: env.opts.autoescape, lineno, colno, context: "ctx:0:0" });');
  });

  test('opens a per-expression try and emits a stream catch when streamErrorRecovery is on', () => {
    const c = makeCompiler({ streamErrorRecovery: true });
    compileOutput(asCompiler(c), { node: output(ZERO_LOC, [symbol(ZERO_LOC, 'x')]), frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('lineno = 0; colno = 0; try { output += runtime.suppressValue(');
    expect(c.streamCatches).toEqual(['catch(0,0)']);
  });
});
