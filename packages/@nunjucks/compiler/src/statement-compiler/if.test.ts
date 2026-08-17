import { describe, expect, test } from 'bun:test';
import { ifNode, literal, output, templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileIf } from './if.ts';
import { makeIfCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compileIf', () => {
  test('emits if(COND) { ... } without else', () => {
    const c = makeIfCompiler();
    compileIf(asCompiler(c), {
      node: ifNode(ZERO_LOC, {
        cond: literal(ZERO_LOC, true),
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'yes')]),
        alternate: null,
      }),
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('if(');
    expect(joined).toContain('frame.push');
    expect(joined).not.toContain('else');
  });

  test('emits else branch when alternate is present', () => {
    const c = makeIfCompiler();
    compileIf(asCompiler(c), {
      node: ifNode(ZERO_LOC, {
        cond: literal(ZERO_LOC, true),
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'yes')]),
        alternate: output(ZERO_LOC, [templateData(ZERO_LOC, 'no')]),
      }),
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('else');
  });
});
