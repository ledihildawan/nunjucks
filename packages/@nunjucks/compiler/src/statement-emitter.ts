import type { Node } from '@nunjucks/nodes';
import type { Emitter, ScopeManager } from './index.ts';

export const emitFuncBegin = (
  compiler: Emitter & ScopeManager,
  node: Node,
  name: string
): void => {
  compiler.buffer = 'output';
  compiler.scopeStack = [];
  compiler.emitLine(`async function ${name}(env, context, frame, runtime) {`);
  compiler.emitLine(`let lineno = ${node.lineno};`);
  compiler.emitLine(`let colno = ${node.colno ?? 0};`);
  compiler.emitLine(`let ${compiler.buffer} = "";`);
  compiler.emitLine('try {');
};

export const emitFuncEnd = (compiler: Emitter & ScopeManager, noReturn?: boolean): void => {
  if (!noReturn) {
    compiler.emitLine(`return ${compiler.buffer};`);
  }

  compiler.closeScopeLevels();
  compiler.emitLine('} catch (e) {');
  compiler.emitLine('  throw runtime.handleError(e, { lineno, colno });');
  compiler.emitLine('}');
  compiler.emitLine('}');
  compiler.buffer = null;
};

export const addScopeLevel = (
  compiler: Pick<ScopeManager, 'scopeStack'>
): void => {
  compiler.scopeStack.push('})');
};

export const closeScopeLevels = (
  compiler: Pick<ScopeManager, 'scopeStack'> & Pick<Emitter, 'emitLine'>
): void => {
  if (compiler.scopeStack.length > 0) {
    compiler.emitLine(`${compiler.scopeStack.join('')};`);
    compiler.scopeStack = [];
  }
};

export const withScopedSyntax = (
  compiler: Pick<ScopeManager, 'scopeStack' | 'closeScopeLevels'>,
  func: () => void
): void => {
  const savedScope = compiler.scopeStack;
  compiler.scopeStack = [];
  func();
  compiler.closeScopeLevels();
  compiler.scopeStack = savedScope;
};
