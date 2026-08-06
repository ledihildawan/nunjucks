import type { ExecNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLineLocation } from '../compiler-helpers.ts';

export const compileExec = (ctx: Compiler, node: ExecNode, frame: Frame): void => {
  emitLineLocation(ctx, node.lineno, node.colno);
  ctx.emitLine('try {');
  ctx.emit('(');
  ctx.compileExpression(node.expr, frame);
  ctx.emitLine(');');
  ctx.emitLine('} catch (e) {');
  ctx.emitLine("  if (e instanceof Error && !e.code) {");
  ctx.emitLine("    e.code = 'EXEC_EXPRESSION_ERROR';");
  ctx.emitLine('  }');
  ctx.emitLine('  throw e;');
  ctx.emitLine('}');
};
