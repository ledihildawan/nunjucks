import { describe, test, expect } from 'bun:test';
import { compileFromImport } from './from-import.ts';
import { fromImportNode, literal, nodeList, symbol, pair } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';

const templateLoc = loc({ lineno: 1, colno: 4 });

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    tmpid: () => { id += 1; return `t_${id}`; },
    getTemplateName: () => '"parent"',
    compileExpression: (node: { value?: unknown }) => { emitted.push(String(node.value ?? 'TPL')); },
  };
};

const buildFromImportNode = (
  names: ReturnType<typeof nodeList>,
  withContext = false,
) =>
  fromImportNode(templateLoc, {
    template: literal(templateLoc, 'lib.njk'),
    names,
    withContext,
  });

describe('compileFromImport', () => {
  test('emits the getTemplate lookup then the getExported header for the module', () => {
    const c = makeCompiler();
    compileFromImport(asCompiler(c), {
      node: buildFromImportNode(nodeList(templateLoc, [symbol(templateLoc, 'foo')])),
      frame: createFrame(),
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('lineno = 1; colno = 5;');
    expect(joined).toContain('let t_1 = await env.getTemplate({ name: lib.njk, eagerCompile: false, includeChain: "parent", ignoreMissing: false });');
    expect(joined).toContain('let t_1_exported = await t_1.getExported();');
  });

  test('passes context.getVariables(), frame to getExported when withContext is true', () => {
    const c = makeCompiler();
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
        const c = makeCompiler();
        compileFromImport(asCompiler(c), { node: buildFromImportNode(names), frame: createFrame() });
        const joined = c.emitted.join('');
        expect(joined).toContain(`if(Object.hasOwn(t_1_exported, ${JSON.stringify(importedName)})) {`);
        expect(joined).toContain(`t_2 = t_1_exported[${JSON.stringify(importedName)}];`);
        expect(joined).toContain(`throw new Error('Cannot import ' + ${JSON.stringify(importedName)} + ' from module');`);
        expect(joined).toContain(`context = context.setVariable(${JSON.stringify(alias)}, t_2);`);
      });
    });
  });

  test('emits an Object.hasOwn guard plus a missing-import throw for every imported name', () => {
    const c = makeCompiler();
    compileFromImport(asCompiler(c), {
      node: buildFromImportNode(nodeList(templateLoc, [
        symbol(templateLoc, 'foo'),
        symbol(templateLoc, 'bar'),
      ])),
      frame: createFrame(),
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('if(Object.hasOwn(t_1_exported, "foo")) {');
    expect(joined).toContain('if(Object.hasOwn(t_1_exported, "bar")) {');
    expect(joined).toContain("throw new Error('Cannot import ' + \"foo\" + ' from module');");
    expect(joined).toContain("throw new Error('Cannot import ' + \"bar\" + ' from module');");
    expect(joined).toContain('t_2 = t_1_exported["foo"];');
    expect(joined).toContain('t_3 = t_1_exported["bar"];');
  });

  test('writes through frame.set when the frame has a parent', () => {
    const c = makeCompiler();
    compileFromImport(asCompiler(c), {
      node: buildFromImportNode(nodeList(templateLoc, [symbol(templateLoc, 'foo')])),
      frame: createFrame({ parent: createFrame() }),
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('frame = frame.set({ name: "foo", value: t_2 });');
    expect(joined).not.toContain('context.setVariable');
  });
});
