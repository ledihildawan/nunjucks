import type { Node } from '@nunjucks/nodes';
import type { Compiler } from './index.ts';

export const emitFuncBegin = (
  ctx: Compiler,
  node: Node,
  name: string
): void => {
  ctx.buffer = 'output';
  ctx.scopeStack = [];
  ctx.emitLine(`async function ${name}(env, context, frame, runtime) {`);
  ctx.emitLine(`let lineno = ${node.lineno};`);
  ctx.emitLine(`let colno = ${node.colno ?? 0};`);
  ctx.emitLine(`let ${ctx.buffer} = "";`);
  ctx.emitLine('try {');
};

export const emitFuncEnd = (ctx: Compiler, noReturn?: boolean): void => {
  if (!noReturn) {
    ctx.emitLine(`return ${ctx.buffer};`);
  }

  ctx.closeScopeLevels();
  ctx.emitLine('} catch (e) {');
  ctx.emitLine('  throw runtime.handleError(e, lineno, colno);');
  ctx.emitLine('}');
  ctx.emitLine('}');
  ctx.buffer = null;
};

export const addScopeLevel = (
  ctx: Pick<Compiler, 'scopeStack'>
): void => {
  ctx.scopeStack.push('})');
};

export const closeScopeLevels = (
  ctx: Pick<Compiler, 'scopeStack' | 'emitLine'>
): void => {
  if (ctx.scopeStack.length > 0) {
    ctx.emitLine(`${ctx.scopeStack.join('')};`);
    ctx.scopeStack = [];
  }
};

export const withScopedSyntax = (
  ctx: Pick<
    Compiler,
    'scopeStack' | 'closeScopeLevels'
  >,
  func: () => void
): void => {
  const savedScope = ctx.scopeStack;
  ctx.scopeStack = [];
  func();
  ctx.closeScopeLevels();
  ctx.scopeStack = savedScope;
};
