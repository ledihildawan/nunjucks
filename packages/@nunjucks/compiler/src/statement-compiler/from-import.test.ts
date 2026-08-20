import { describe, expect, test } from 'bun:test';
import type { TemplateError } from '@nunjucks/error-formatter';
import { fromImportNode, literal, nodeList, pair, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { loc } from '@nunjucks/shared';
import { asCompiler, makeCodegenCompiler } from '../test-helpers.ts';
import { compileFromImport } from './from-import.ts';
import { makeImportCompiler } from './test-helpers.ts';

const templateLoc = loc({ lineno: 1, colno: 4 });

const buildFromImportNode = (names: ReturnType<typeof nodeList>, withContext = false) =>
  fromImportNode(templateLoc, {
    template: literal(templateLoc, 'lib.njk'),
    names,
    withContext,
  });

describe('compileFromImport', () => {
  test('emits the getTemplate lookup then the getExported header for the module', () => {
    const c = makeImportCompiler();
    compileFromImport(asCompiler(c), {
      node: buildFromImportNode(nodeList(templateLoc, [symbol(templateLoc, 'foo')])),
      frame: createFrame(),
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('lineno = 1; colno = 5;');
    expect(joined).toContain(
      'let t_1 = await env.getTemplate({ name: lib.njk, eagerCompile: false, includeChain: "parent", ignoreMissing: false });'
    );
    expect(joined).toContain('let t_1_exported = await t_1.getExported();');
  });

  test('passes context.getVariables(), frame to getExported when withContext is true', () => {
    const c = makeImportCompiler();
    compileFromImport(asCompiler(c), {
      node: buildFromImportNode(nodeList(templateLoc, [symbol(templateLoc, 'foo')]), true),
      frame: createFrame(),
    });
    expect(c.emitted.join('')).toContain('await t_1.getExported(context.getVariables(), frame);');
  });

  describe('name extraction — pair (alias) vs symbol', () => {
    const nameCases: ReadonlyArray<{
      label: string;
      names: ReturnType<typeof nodeList>;
      importedName: string;
      alias: string;
    }> = [
      {
        label: 'symbol name "foo" — name and alias are both "foo"',
        names: nodeList(templateLoc, [symbol(templateLoc, 'foo')]),
        importedName: 'foo',
        alias: 'foo',
      },
      {
        label: 'pair with symbol key (foo as bar) — name "foo", alias "bar"',
        names: nodeList(templateLoc, [
          pair(templateLoc, { key: symbol(templateLoc, 'foo'), val: symbol(templateLoc, 'bar') }),
        ]),
        importedName: 'foo',
        alias: 'bar',
      },
      {
        label: 'pair with string key (baz as qux) — name "baz", alias "qux"',
        names: nodeList(templateLoc, [
          pair(templateLoc, { key: 'baz', val: symbol(templateLoc, 'qux') }),
        ]),
        importedName: 'baz',
        alias: 'qux',
      },
    ];
    nameCases.forEach(({ label, names, importedName, alias }) => {
      test(label, () => {
        const c = makeImportCompiler();
        compileFromImport(asCompiler(c), {
          node: buildFromImportNode(names),
          frame: createFrame(),
        });
        const joined = c.emitted.join('');
        expect(joined).toContain(
          `if(Object.hasOwn(t_1_exported, ${JSON.stringify(importedName)})) {`
        );
        expect(joined).toContain(`t_2 = t_1_exported[${JSON.stringify(importedName)}];`);
        expect(joined).toContain(
          `const importError = new Error('Cannot import ' + ${JSON.stringify(importedName)} + ' from module'); importError.code = 'IMPORT_ERROR';`
        );
        expect(joined).toContain(`context = context.setVariable(${JSON.stringify(alias)}, t_2);`);
      });
    });
  });

  test('emits an Object.hasOwn guard plus a missing-import throw for every imported name', () => {
    const c = makeImportCompiler();
    compileFromImport(asCompiler(c), {
      node: buildFromImportNode(
        nodeList(templateLoc, [symbol(templateLoc, 'foo'), symbol(templateLoc, 'bar')])
      ),
      frame: createFrame(),
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('if(Object.hasOwn(t_1_exported, "foo")) {');
    expect(joined).toContain('if(Object.hasOwn(t_1_exported, "bar")) {');
    expect(joined).toContain(
      "const importError = new Error('Cannot import ' + \"foo\" + ' from module'); importError.code = 'IMPORT_ERROR';"
    );
    expect(joined).toContain(
      "const importError = new Error('Cannot import ' + \"bar\" + ' from module'); importError.code = 'IMPORT_ERROR';"
    );
    expect(joined).toContain('t_2 = t_1_exported["foo"];');
    expect(joined).toContain('t_3 = t_1_exported["bar"];');
  });

  test('writes through frame.set when the frame has a parent', () => {
    const c = makeImportCompiler();
    compileFromImport(asCompiler(c), {
      node: buildFromImportNode(nodeList(templateLoc, [symbol(templateLoc, 'foo')])),
      frame: createFrame({ parent: createFrame() }),
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('frame = frame.set({ name: "foo", value: t_2 });');
    expect(joined).not.toContain('context.setVariable');
  });

  test('fails loudly when a pair alias value is not a name', () => {
    // WHY: regression — String() coercion of a malformed pair value used to
    // bind the alias "undefined" silently; it must surface as a catalogued
    // compile error instead.
    const compiler = makeCodegenCompiler();
    const node = buildFromImportNode(
      nodeList(templateLoc, [
        pair(templateLoc, { key: symbol(templateLoc, 'foo'), val: literal(templateLoc, 3) }),
      ])
    );
    let caught: unknown;
    try {
      compileFromImport(asCompiler(compiler), { node, frame: createFrame() });
    } catch (error: unknown) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const templateError = caught as TemplateError;
    expect(templateError.code).toBe('WALK_UNKNOWN_TYPE');
    expect(String(templateError.message)).toContain('alias must be a name');
  });
});
