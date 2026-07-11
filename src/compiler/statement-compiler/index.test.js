import { describe, test, expect } from 'bun:test';
import * as mod from './index.js';

describe('compiler/statement-compiler exports', () => {
  test('exports compileIf', () => expect(mod.compileIf).toBeFunction());
  test('exports compileIfAsync', () => expect(mod.compileIfAsync).toBeFunction());
  test('exports compileSet', () => expect(mod.compileSet).toBeFunction());
  test('exports compileSwitch', () => expect(mod.compileSwitch).toBeFunction());
  test('exports compileFor', () => expect(mod.compileFor).toBeFunction());
  test('exports emitLoopBindings', () => expect(mod.emitLoopBindings).toBeFunction());
  test('exports compileMacroPublic', () => expect(mod.compileMacroPublic).toBeFunction());
  test('exports compileCaller', () => expect(mod.compileCaller).toBeFunction());
  test('exports compileBlock', () => expect(mod.compileBlock).toBeFunction());
  test('exports compileSuper', () => expect(mod.compileSuper).toBeFunction());
  test('exports compileImport', () => expect(mod.compileImport).toBeFunction());
  test('exports compileFromImport', () => expect(mod.compileFromImport).toBeFunction());
  test('exports compileExtends', () => expect(mod.compileExtends).toBeFunction());
  test('exports compileInclude', () => expect(mod.compileInclude).toBeFunction());
  test('exports compileTemplateData', () => expect(mod.compileTemplateData).toBeFunction());
  test('exports compileCapture', () => expect(mod.compileCapture).toBeFunction());
  test('exports compileOutput', () => expect(mod.compileOutput).toBeFunction());
  test('exports compileRoot', () => expect(mod.compileRoot).toBeFunction());
  test('exports compileCallExtension', () => expect(mod.compileCallExtension).toBeFunction());
  test('exports compileCallExtensionAsync', () => expect(mod.compileCallExtensionAsync).toBeFunction());
});
