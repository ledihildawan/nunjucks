import type { Node } from '@nunjucks/nodes';
import type { Emitter, ScopeManager } from './index.ts';

export const emitFuncBegin = (
  compiler: Emitter & ScopeManager,
  node: Node,
  name: string
): void => {
  // WHY: Option B streaming — only `root` renders as an async generator (`buffer === null` signals "yield" to appendTarget); block/slot functions still return a plain string buffer. Diverging by name keeps the emit infrastructure shared while making the top-level template streamable.
  const isRoot = name === 'root';
  compiler.buffer = isRoot ? null : 'output';
  compiler.scopeStack = [];
  compiler.emitLine(`async function${isRoot ? '*' : ''} ${name}(env, context, frame, runtime) {`);
  compiler.emitLine(`let lineno = ${node.lineno};`);
  compiler.emitLine(`let colno = ${node.colno ?? 0};`);
  if (!isRoot) {
    compiler.emitLine(`let ${compiler.buffer} = "";`);
  }
  compiler.emitLine('try {');
};

export const emitFuncEnd = (compiler: Emitter & ScopeManager, noReturn?: boolean): void => {
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
