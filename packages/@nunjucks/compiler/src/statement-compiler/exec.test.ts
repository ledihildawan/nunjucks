import { describe, expect, test } from 'bun:test';
import { funCall, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { loc } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileExec } from './exec.ts';
import { makeExecCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compileExec', () => {
  test('wraps expression in try/catch', () => {
    const c = makeExecCompiler();
    compileExec(asCompiler(c), {
      node: {
        lineno: 3,
        colno: 7,
        expr: funCall(loc({ lineno: 3, colno: 7 }), {
          name: symbol(loc({ lineno: 3, colno: 7 }), 'fn'),
          args: [],
        }),
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
