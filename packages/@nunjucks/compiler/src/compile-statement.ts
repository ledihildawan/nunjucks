import type { Node } from '@nunjucks/nodes';
import type { Compiler } from './index.ts';

export const emitFuncBegin = (
  ctx: Compiler,
  node: Node,
  name: string
): void => {
  ctx.buffer = 'output';
  ctx.scopeClosers = '';
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
  ctx.emitLine('  throw runtime.handleError(e, lineno, colno, runtime);');
  ctx.emitLine('}');
  ctx.emitLine('}');
  ctx.buffer = null;
};

export const addScopeLevel = (
  ctx: Pick<Compiler, 'scopeClosers'>
): void => {
  ctx.scopeClosers += '})';
};

export const closeScopeLevels = (
  ctx: Pick<Compiler, 'scopeClosers' | 'emitLine'>
): void => {
  if (ctx.scopeClosers) {
    ctx.emitLine(`${ctx.scopeClosers};`);
  }
  ctx.scopeClosers = '';
};

export const withScopedSyntax = (
  ctx: Pick<
    Compiler,
    'scopeClosers' | 'closeScopeLevels'
  >,
  func: () => void
): void => {
  const savedScopeClosers = ctx.scopeClosers;
  ctx.scopeClosers = '';
  func();
  ctx.closeScopeLevels();
  ctx.scopeClosers = savedScopeClosers;
};
