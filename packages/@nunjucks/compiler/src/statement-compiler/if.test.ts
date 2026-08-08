import { describe, test, expect } from 'bun:test';
import { compileIf } from './if.ts';
import { literal, output, templateData } from '@nunjucks/nodes';
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
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'BODY'); },
    compileExpression: (n: { mock?: string }) => { emitted.push(n.mock ?? 'COND'); },
    withScopedSyntax: (fn: () => void) => fn(),
  };
};

describe('compileIf', () => {
  test('emits if(COND) { ... } without else', () => {
    const c = makeCompiler();
    compileIf(asCompiler(c), {
      cond: literal(ZERO_LOC, true),
      body: output(ZERO_LOC, [templateData(ZERO_LOC, 'yes')]),
      alternate: null,
    } as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('if(');
    expect(joined).toContain('frame.push');
    expect(joined).not.toContain('else');
  });

  test('emits else branch when alternate is present', () => {
    const c = makeCompiler();
    compileIf(asCompiler(c), {
      cond: literal(ZERO_LOC, true),
      body: output(ZERO_LOC, [templateData(ZERO_LOC, 'yes')]),
      alternate: output(ZERO_LOC, [templateData(ZERO_LOC, 'no')]),
    } as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('else');
  });
});