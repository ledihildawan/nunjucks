import { describe, expect, test } from 'bun:test';
import { ifNode, literal, output, templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileIf } from './if.ts';
import { makeFrameTrackingCompiler, makeIfCompiler } from './test-helpers.ts';

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

  test('compiles each branch against a pushed compile-time frame', () => {
    // WHY: create-compiler contract — the compile-time frame must mirror the
    // emitted `frame.push/pop`, so branch bodies see a frame whose parent is
    // the enclosing frame, while the condition sees the enclosing frame itself.
    const c = makeFrameTrackingCompiler();
    const parent = createFrame();
    compileIf(asCompiler(c), {
      node: ifNode(ZERO_LOC, {
        cond: literal(ZERO_LOC, true),
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'yes')]),
        alternate: output(ZERO_LOC, [templateData(ZERO_LOC, 'no')]),
      }),
      frame: parent,
    });
    const [condFrame, bodyFrame, elseFrame] = c.frames;
    expect(condFrame).toBe(parent);
    expect(bodyFrame?.parent).toBe(parent);
    expect(elseFrame?.parent).toBe(parent);
  });
});
