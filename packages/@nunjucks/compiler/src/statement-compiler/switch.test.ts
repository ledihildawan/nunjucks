import { describe, test, expect } from 'bun:test';
import { compileSwitch } from './switch.ts';
import { symbol, literal, output, templateData, caseNode, switchNode } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { ZERO_LOC } from '@nunjucks/shared';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'X'); },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

describe('compileSwitch', () => {
  test('emits switch with cases and default', () => {
    const c = makeCompiler();
    const node = switchNode(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'x'),
      cases: [caseNode(ZERO_LOC, { cond: literal(ZERO_LOC, 1), body: output(ZERO_LOC, [templateData(ZERO_LOC, 'one')]) })],
      default_: output(ZERO_LOC, [templateData(ZERO_LOC, 'd')]),
    });
    compileSwitch(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('switch (');
    expect(joined).toContain('case ');
    expect(joined).toContain('break;');
    expect(joined).toContain('default:');
  });

  test('omits default when not present', () => {
    const c = makeCompiler();
    const node = switchNode(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'x'),
      cases: [caseNode(ZERO_LOC, { cond: literal(ZERO_LOC, 1), body: output(ZERO_LOC, [templateData(ZERO_LOC, 'one')]) })],
      default_: null,
    });
    compileSwitch(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).not.toContain('default:');
  });
});