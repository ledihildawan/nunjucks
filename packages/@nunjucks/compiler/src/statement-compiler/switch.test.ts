import { describe, expect, test } from 'bun:test';
import { caseNode, literal, output, switchNode, symbol, templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileSwitch } from './switch.ts';
import { makeSwitchCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compileSwitch', () => {
  test('emits switch with cases and default', () => {
    const c = makeSwitchCompiler();
    const node = switchNode(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'x'),
      cases: [
        caseNode(ZERO_LOC, {
          cond: literal(ZERO_LOC, 1),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'one')]),
        }),
      ],
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
    const c = makeSwitchCompiler();
    const node = switchNode(ZERO_LOC, {
      expr: symbol(ZERO_LOC, 'x'),
      cases: [
        caseNode(ZERO_LOC, {
          cond: literal(ZERO_LOC, 1),
          body: output(ZERO_LOC, [templateData(ZERO_LOC, 'one')]),
        }),
      ],
      default_: null,
    });
    compileSwitch(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).not.toContain('default:');
  });
});
