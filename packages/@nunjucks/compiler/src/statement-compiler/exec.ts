import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { ExecNode } from '@nunjucks/nodes';
import { emitLineLocation } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

/**
 * Compiles `{% exec %}` to a try/catch around the bare expression,
 * tagging un-coded errors `EXEC_EXPRESSION_ERROR` and yielding an inline
 * marker instead of rethrowing when `streamErrorRecovery` is on.
 */
export const compileExec = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ExecNode>
): void => {
  emitLineLocation(compiler, node.lineno, node.colno);
  compiler.emitLine('try {');
  compiler.emit('(');
  compiler.compileExpression(node.expr, frame);
  compiler.emitLine(');');
  compiler.emitLine('} catch (e) {');
  compiler.emitLine('  if (e instanceof Error && !e.code) {');
  compiler.emitLine(`    e.code = '${ERROR_CODES.EXEC_EXPRESSION_ERROR}';`);
  compiler.emitLine('  }');
  if (compiler.streamErrorRecovery) {
    compiler.emitLine(
      `  lineno = ${node.lineno}; colno = ${node.colno}; yield runtime.streamError(e, { lineno, colno });`
    );
  } else {
    compiler.emitLine('  throw e;');
  }
  compiler.emitLine('}');
};
