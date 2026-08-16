import { describe, expect, test } from 'bun:test';
import { importNode, literal } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { loc } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileImport } from './import.ts';

const templateLoc = loc({ lineno: 2, colno: 5 });

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
    getTemplateName: () => '"parent"',
    compileExpression: (node: { value?: unknown }) => {
      emitted.push(String(node.value ?? 'TPL'));
    },
  };
};

const buildImportNode = (withContext: boolean) =>
  importNode(templateLoc, {
    template: literal(templateLoc, 'lib.njk'),
    target: 'myLib',
    withContext,
  });

describe('compileImport', () => {
  test('emits the getTemplate lookup then getExported with no context args when withContext is false', () => {
    const c = makeCompiler();
    compileImport(asCompiler(c), { node: buildImportNode(false), frame: createFrame() });
    const joined = c.emitted.join('');
    expect(joined).toContain('lineno = 2; colno = 6;');
    expect(joined).toContain(
      'let t_1 = await env.getTemplate({ name: lib.njk, eagerCompile: false, includeChain: "parent", ignoreMissing: false });'
    );
    expect(joined).toContain('let t_1_exported = await t_1.getExported();');
    expect(joined).toContain('context = context.setVariable("myLib", t_1_exported);');
  });

  describe('withContext argument matrix', () => {
    const withContextCases: ReadonlyArray<{ withContext: boolean; exportedCall: string }> = [
      { withContext: false, exportedCall: 'await t_1.getExported();' },
      { withContext: true, exportedCall: 'await t_1.getExported(context.getVariables(), frame);' },
    ];
    withContextCases.forEach(({ withContext, exportedCall }) => {
      test(`emits "${exportedCall}" when withContext is ${String(withContext)}`, () => {
        const c = makeCompiler();
        compileImport(asCompiler(c), { node: buildImportNode(withContext), frame: createFrame() });
        expect(c.emitted.join('')).toContain(exportedCall);
      });
    });
  });

  describe('frame write target', () => {
    const frameCases: ReadonlyArray<{
      label: string;
      hasParent: boolean;
      expected: string;
      forbidden: string;
    }> = [
      {
        label: 'root frame (no parent) writes through context.setVariable',
        hasParent: false,
        expected: 'context = context.setVariable("myLib", t_1_exported);',
        forbidden: 'frame = frame.set(',
      },
      {
        label: 'child frame (has parent) writes through frame.set',
        hasParent: true,
        expected: 'frame = frame.set({ name: "myLib", value: t_1_exported });',
        forbidden: 'context.setVariable',
      },
    ];
    frameCases.forEach(({ label, hasParent, expected, forbidden }) => {
      test(label, () => {
        const c = makeCompiler();
        const frame = hasParent ? createFrame({ parent: createFrame() }) : createFrame();
        compileImport(asCompiler(c), { node: buildImportNode(false), frame });
        const joined = c.emitted.join('');
        expect(joined).toContain(expected);
        expect(joined).not.toContain(forbidden);
      });
    });
  });
});
