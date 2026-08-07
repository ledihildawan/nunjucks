import type { ExecNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLineLocation } from '../codegen.ts';

export const compileExec = (compiler: Compiler, node: ExecNode, frame: Frame): void => {
  emitLineLocation(compiler, node.lineno, node.colno);
  compiler.emitLine('try {');
  compiler.emit('(');
  compiler.compileExpression(node.expr, frame);
  compiler.emitLine(');');
  compiler.emitLine('} catch (e) {');
  compiler.emitLine("  if (e instanceof Error && !e.code) {");
  compiler.emitLine("    e.code = 'EXEC_EXPRESSION_ERROR';");
  compiler.emitLine('  }');
  compiler.emitLine('  throw e;');
  compiler.emitLine('}');
};
