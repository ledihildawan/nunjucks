import { isNonNullish } from 'remeda';

export const emit = (ctx, code) => ctx.codebuf.push(code);

export const emitLine = (ctx, code, originalLine) => {
  ctx.compiledLine++;
  if (isNonNullish(originalLine)) {
    ctx.sourceMap.addMapping(ctx.compiledLine, originalLine);
  }
  emit(ctx, code + '\n');
};

export const emitLineWithMapping = (ctx, code, templateLine, templateCol) => {
  ctx.compiledLine++;
  if (templateLine !== undefined) {
    ctx.sourceMap.addMapping(ctx.compiledLine, templateLine, templateCol || 0);
  }
  emit(ctx, code + '\n');
};

export const emitLineWithLineno = (ctx, code, templateLine, templateCol) => {
  ctx.compiledLine++;
  if (templateLine !== undefined) {
    ctx.sourceMap.addMapping(ctx.compiledLine, templateLine, templateCol || 0);
  }
  emit(ctx, code + '\n');
};

export const emitLines = (ctx, ...lines) => {
  lines.forEach((line) => emitLine(ctx, line));
};

export const pushBuffer = (ctx) => {
  const id = tmpid(ctx);
  ctx.bufferStack.push(ctx.buffer);
  ctx.buffer = id;
  emit(ctx, `let ${id} = "";`);
  return id;
};

export const popBuffer = (ctx) => {
  ctx.buffer = ctx.bufferStack.pop();
};

export const tmpid = (ctx) => {
  ctx.lastId++;
  return 't_' + ctx.lastId;
};

export const addScopeLevel = (ctx) => {
  ctx._scopeClosers += '})';
};

export const closeScopeLevels = (ctx) => {
  if (ctx._scopeClosers) {
    emitLine(ctx, ctx._scopeClosers + ';');
  }
  ctx._scopeClosers = '';
};

export const withScopedSyntax = (ctx, func) => {
  const saved = ctx._scopeClosers;
  ctx._scopeClosers = '';
  func.call(ctx);
  closeScopeLevels(ctx);
  ctx._scopeClosers = saved;
};

export const templateNameStr = (ctx) =>
  ctx.templateName === null || ctx.templateName === undefined ? 'undefined' : JSON.stringify(ctx.templateName);

export const emitFuncBegin = (ctx, node, name) => {
  ctx.buffer = 'output';
  ctx._scopeClosers = '';
  emitLine(ctx, `async function ${name}(env, context, frame, runtime) {`);
  emitLineWithMapping(ctx, `let lineno = ${node.lineno};`, node.lineno, node.colno);
  emitLine(ctx, `let colno = ${node.colno};`);
  emitLine(ctx, `let ${ctx.buffer} = "";`);
  emitLine(ctx, 'try {');
};

export const emitFuncEnd = (ctx, noReturn) => {
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
