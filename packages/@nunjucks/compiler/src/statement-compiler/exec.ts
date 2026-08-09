import type { ExecNode } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { emitLineLocation } from '../codegen.ts';

export const compileExec = (compiler: Compiler, { node, frame }: CompileNodeInput<ExecNode>): void => {
  emitLineLocation(compiler, node.lineno, node.colno);
  compiler.emitLine('try {');
  compiler.emit('(');
  compiler.compileExpression(node.expr, frame);
  compiler.emitLine(');');
  compiler.emitLine('} catch (e) {');
  compiler.emitLine("  if (e instanceof Error && !e.code) {");
  compiler.emitLine("    e.code = 'EXEC_EXPRESSION_ERROR';");
  compiler.emitLine('  }');
  if (compiler.streamErrorRecovery) {
    compiler.emitLine(`  lineno = ${node.lineno ?? 0}; colno = ${node.colno ?? 0}; yield runtime.streamError(e, { lineno, colno });`);
  } else {
    compiler.emitLine('  throw e;');
  }
  compiler.emitLine('}');
};
