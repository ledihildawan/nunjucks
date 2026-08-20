import { describe, expect, test } from 'bun:test';
import { literal, output, pair, templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileScope } from './scope.ts';
import { makeFrameTrackingCompiler, makeScopeCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compileScope', () => {
  test('pushes a frame, binds assignments, compiles body, pops frame', () => {
    const c = makeScopeCompiler();
    compileScope(asCompiler(c), {
      node: {
        assignments: [pair(ZERO_LOC, { key: 'x', val: literal(ZERO_LOC, 1) })],
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'scoped')]),
      } as never,
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('frame = frame.push(true);');
    expect(joined).toContain('frame = frame.set({ name: "x", value: t_1, resolveUp: true });');
    expect(joined).toContain('frame = frame.pop();');
  });

  test('compiles without assignments', () => {
    const c = makeScopeCompiler();
    compileScope(asCompiler(c), {
      node: {
        assignments: [],
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'scoped')]),
      } as never,
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).not.toContain('frame.set');
  });

  test('compiles assignments and body against the pushed compile-time frame', () => {
    // WHY: create-compiler contract — the compile-time frame must mirror the
    // emitted `frame.push/pop`; assignments run inside the pushed scope at
    // runtime, so they compile against the pushed frame too.
    const c = makeFrameTrackingCompiler();
    const parent = createFrame();
    compileScope(asCompiler(c), {
      node: {
        assignments: [pair(ZERO_LOC, { key: 'x', val: literal(ZERO_LOC, 1) })],
        body: output(ZERO_LOC, [templateData(ZERO_LOC, 'scoped')]),
      } as never,
      frame: parent,
    });
    const [assignmentFrame, bodyFrame] = c.frames;
    expect(assignmentFrame?.parent).toBe(parent);
    expect(bodyFrame).toBe(assignmentFrame);
  });
});
