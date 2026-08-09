import type { IfNode } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

export const compileIf = (compiler: Compiler, { node, frame }: CompileNodeInput<IfNode>): void => {
  if (compiler.streamErrorRecovery) {
    const condVar = compiler.tmpid();
    const { lineno: rawLine, colno: rawCol } = node;
    const lineno = rawLine ?? 0;
    const colno = rawCol ?? 0;
    compiler.emitLine(`let ${condVar};`);
    compiler.emitLine(`try { ${condVar} = (`);
    compiler.compileExpression(node.cond, frame);
    compiler.emitLine(`); } catch(e) { ${condVar} = false; lineno = ${lineno}; colno = ${colno}; yield runtime.streamError(e, { lineno, colno }); }`);
    compiler.emitLine(`if(${condVar}) {`);
  } else {
    compiler.emit('if(');
    compiler.compileExpression(node.cond, frame);
    compiler.emitLine(') {');
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
