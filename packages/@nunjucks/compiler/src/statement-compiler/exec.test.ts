import { describe, test, expect } from 'bun:test';
import { compileExec } from './exec.ts';
import { funCall, symbol } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc } from '@nunjucks/shared';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    compileExpression: (n: { mock?: string }) => { emitted.push(n.mock ?? 'EXPR'); },
  };
};

describe('compileExec', () => {
  test('wraps expression in try/catch', () => {
    const c = makeCompiler();
    compileExec(asCompiler(c), {
      node: {
        lineno: 3, colno: 7,
        expr: funCall(loc({ lineno: 3, colno: 7 }), { name: symbol(loc({ lineno: 3, colno: 7 }), 'fn'), args: [] }),
      } as never,
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('lineno = 3; colno = 7;');
    expect(joined).toContain('try {');
    expect(joined).toContain('(EXPR);');
    expect(joined).toContain("e.code = 'EXEC_EXPRESSION_ERROR'");
    expect(joined).toContain('} catch (e) {');
  });
});