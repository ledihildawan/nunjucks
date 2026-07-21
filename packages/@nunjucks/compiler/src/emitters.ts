import { isNonNullish } from 'remeda';
import type { Node } from '@nunjucks/nodes';
import type { SourceMap } from './source-map.ts';

export interface EmitterCtx {
  codebuf: string[];
  lastId: number;
  buffer: string | null;
  bufferStack: Array<string | null>;
  _scopeClosers: string;
  templateName: string | null;
  compiledLine: number;
  sourceMap: SourceMap;
}

export const emit = (ctx: EmitterCtx, code: string): void => {
  ctx.codebuf.push(code);
};

export const emitLine = (ctx: EmitterCtx, code: string, originalLine?: number, colno: number = 0): void => {
  ctx.compiledLine++;
  if (originalLine !== undefined) {
    ctx.sourceMap.addMapping(ctx.compiledLine, originalLine, colno);
  }
  emit(ctx, code + '\n');
};

export const emitLineWithMapping = emitLine;

export const emitLineWithLineno = emitLine;

export const emitLines = (ctx: EmitterCtx, ...lines: string[]): void => {
  lines.forEach((line) => emitLine(ctx, line));
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
  ctx.lastId++;
  return 't_' + ctx.lastId;
};

export const addScopeLevel = (ctx: EmitterCtx): void => {
  ctx._scopeClosers += '})';
};

export const closeScopeLevels = (ctx: EmitterCtx): void => {
  if (ctx._scopeClosers) {
    emitLine(ctx, ctx._scopeClosers + ';');
  }
  ctx._scopeClosers = '';
};

export const withScopedSyntax = (ctx: EmitterCtx, func: () => void): void => {
  const saved = ctx._scopeClosers;
  ctx._scopeClosers = '';
  func.call(ctx);
  closeScopeLevels(ctx);
  ctx._scopeClosers = saved;
};

export const templateNameStr = (ctx: { templateName: string | null }): string =>
  ctx.templateName === null || ctx.templateName === undefined ? 'undefined' : JSON.stringify(ctx.templateName);

export const emitFuncBegin = (ctx: EmitterCtx, node: Node, name: string): void => {
  ctx.buffer = 'output';
  ctx._scopeClosers = '';
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
