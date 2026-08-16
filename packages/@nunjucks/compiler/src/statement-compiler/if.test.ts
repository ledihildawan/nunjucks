import { describe, expect, test } from 'bun:test';
import { ifNode, literal, output, templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileIf } from './if.ts';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
    compile: () => {
      emitted.push('BODY');
    },
    compileExpression: () => {
      emitted.push('COND');
    },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

describe('compileIf', () => {
  test('emits if(COND) { ... } without else', () => {
    const c = makeCompiler();
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
    const c = makeCompiler();
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
