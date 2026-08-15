import { describe, expect, test } from 'bun:test';
import { literal, output, pair, templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileScope } from './scope.ts';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
    nextCompilerId: () => {
      id += 1;
      return `t_${id}`;
    },
    compile: (n: { marker?: string }) => {
      emitted.push(n.marker ?? 'BODY');
    },
    compileExpression: (n: { marker?: string }) => {
      emitted.push(n.marker ?? 'VAL');
    },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

describe('compileScope', () => {
  test('pushes a frame, binds assignments, compiles body, pops frame', () => {
    const c = makeCompiler();
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
    const c = makeCompiler();
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
});
