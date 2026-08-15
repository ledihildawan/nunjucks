import type { Node } from '@nunjucks/nodes';
import type { Emitter, ScopeManager } from './index.ts';

export const emitCompilerFuncBegin = (
  compiler: Emitter & ScopeManager,
  node: Node,
  name: string
): void => {
  // WHY: Option C — both root and block functions are async generators that yield output chunks (buffer === null signals 'yield' to appendTarget). Only capture/slot set their own local buffer to accumulate a string. Diverging root vs block is no longer needed.
  void name;
  compiler.buffer = null;
  compiler.scopeStack = [];
  compiler.emitLine(`async function* ${name}(env, context, frame, runtime) {`);
  compiler.emitLine(`let lineno = ${node.lineno};`);
  compiler.emitLine(`let colno = ${node.colno ?? 0};`);
  compiler.emitLine('try {');
};

export const emitCompilerFuncEnd = (compiler: Emitter & ScopeManager, noReturn?: boolean): void => {
  if (!noReturn && compiler.buffer !== null) {
    compiler.emitLine(`return ${compiler.buffer};`);
  }

  compiler.closeScopeLevels();
  compiler.emitLine('} catch (e) {');
  compiler.emitLine('  throw runtime.handleError(e, { lineno, colno });');
  compiler.emitLine('}');
  compiler.emitLine('}');
  compiler.buffer = null;
};

export const addCompilerScopeLevel = (compiler: Pick<ScopeManager, 'scopeStack'>): void => {
  compiler.scopeStack.push('})');
};

export const closeCompilerScopeLevels = (
  compiler: Pick<ScopeManager, 'scopeStack'> & Pick<Emitter, 'emitLine'>
): void => {
  if (compiler.scopeStack.length > 0) {
    compiler.emitLine(`${compiler.scopeStack.join('')};`);
    compiler.scopeStack = [];
  }
};

export const withCompilerScopedSyntax = (
  compiler: Pick<ScopeManager, 'scopeStack' | 'closeScopeLevels'>,
  func: () => void
): void => {
  const savedScope = compiler.scopeStack;
  compiler.scopeStack = [];
  func();
  compiler.closeScopeLevels();
  compiler.scopeStack = savedScope;
};
