import type { IfNode } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

export const compileIf = (compiler: Compiler, { node, frame }: CompileNodeInput<IfNode>): void => {
  // WHY: runtime.isTruthy folds miss sentinels (callable objects) to falsy so
  // `{% if obj.missing %}` takes the false branch like classic nunjucks.
  if (compiler.streamErrorRecovery) {
    const condVar = compiler.nextCompilerId();
    const { lineno: rawLine, colno: rawCol } = node;
    const lineno = rawLine ?? 0;
    const colno = rawCol ?? 0;
    compiler.emitLine(`let ${condVar};`);
    compiler.emitLine(`try { ${condVar} = runtime.isTruthy(`);
    compiler.compileExpression(node.cond, frame);
    compiler.emit('); ');
    compiler.emitStreamCatch(lineno, colno, `${condVar} = false`);
    compiler.emitLine(`if(${condVar}) {`);
  } else {
    compiler.emit('if(runtime.isTruthy(');
    compiler.compileExpression(node.cond, frame);
    compiler.emitLine(')) {');
  }

  compiler.withScopedSyntax(() => {
    compiler.emitLine('frame = frame.push(true);');
    compiler.compile(node.body, frame);
    compiler.emitLine('frame = frame.pop();');
  });

  const elseNode = node.alternate;
  if (elseNode) {
    compiler.emitLine('}\nelse {');

    compiler.withScopedSyntax(() => {
      compiler.emitLine('frame = frame.push(true);');
      compiler.compile(elseNode, frame);
      compiler.emitLine('frame = frame.pop();');
    });
  }

  compiler.emitLine('}');
};
