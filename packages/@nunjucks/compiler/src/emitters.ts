import type { Node } from '@nunjucks/nodes';
import { forEach } from 'remeda';

export interface EmitterCtx {
  codebuf: string[];
  lastId: number;
  buffer: string | null;
  bufferStack: Array<string | null>;
  scopeClosers: string;
  templateName: string | null;
  compiledLine: number;
}

export const emit = (ctx: EmitterCtx, code: string): void => {
  ctx.codebuf.push(code);
};

export const emitLine = (ctx: EmitterCtx, code: string, _originalLine?: number, _colno = 0): void => {
  ctx.compiledLine += 1;
  emit(ctx, `${code}\n`);
};

export const emitLineWithMapping: typeof emitLine = emitLine;

export const emitLines = (ctx: EmitterCtx, ...lines: string[]): void => {
  forEach(lines, line => emitLine(ctx, line));
};

export const pushBuffer = (ctx: EmitterCtx): string => {
  const id = tmpid(ctx);
  ctx.bufferStack.push(ctx.buffer);
  ctx.buffer = id;
  emit(ctx, `let ${id} = "";`);
  return id;
};

export const popBuffer = (ctx: EmitterCtx): void => {
  ctx.buffer = ctx.bufferStack.pop() as string | null;
};

export const tmpid = (ctx: EmitterCtx): string => {
  ctx.lastId += 1;
  return `t_${ctx.lastId}`;
};

export const addScopeLevel = (ctx: EmitterCtx): void => {
  ctx.scopeClosers += '})';
};

export const closeScopeLevels = (ctx: EmitterCtx): void => {
  if (ctx.scopeClosers) {
    emitLine(ctx, `${ctx.scopeClosers};`);
  }
  ctx.scopeClosers = '';
};

export const withScopedSyntax = (ctx: EmitterCtx, func: () => void): void => {
  const saved = ctx.scopeClosers;
  ctx.scopeClosers = '';
  func.call(ctx);
  closeScopeLevels(ctx);
  ctx.scopeClosers = saved;
};

export const templateNameStr = (ctx: { templateName: string | null }): string => {
  if (ctx.templateName === null || ctx.templateName === undefined) {
    return 'undefined';
  }
  return JSON.stringify(ctx.templateName);
};

export const emitFuncBegin = (ctx: EmitterCtx, node: Node, name: string): void => {
  ctx.buffer = 'output';
  ctx.scopeClosers = '';
  emitLine(ctx, `async function ${name}(env, context, frame, runtime) {`);
  emitLineWithMapping(ctx, `let lineno = ${node.lineno};`, node.lineno, node.colno);
  emitLine(ctx, `let colno = ${node.colno};`);
  emitLine(ctx, `let ${ctx.buffer} = "";`);
  emitLine(ctx, 'try {');
};

export const emitFuncEnd = (ctx: EmitterCtx, noReturn?: boolean): void => {
  if (!noReturn) {
    emitLine(ctx, `return ${ctx.buffer};`);
  }
  closeScopeLevels(ctx);
  emitLine(ctx, '} catch (e) {');
  emitLine(ctx, '  throw runtime.handleError(e, lineno, colno, runtime);');
  emitLine(ctx, '}');
  emitLine(ctx, '}');
  ctx.buffer = null;
};