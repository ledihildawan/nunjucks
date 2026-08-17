import type { MatchNode, WhenNode } from '@nunjucks/nodes';
import { isArray, isDict, isLiteral, isSymbol } from '@nunjucks/nodes';
import { forEach } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileDestructuring } from './pattern.ts';

/**
 * Compiles `{% match %}` as cascading `if (!matched && cond)` arms —
 * literals compare with `===`, symbols bind (or match-all as `_`), and
 * array/dict patterns destructure — with an optional trailing default.
 */
export const compileMatch = (
  compiler: Compiler,
  { node, frame: parentFrame }: CompileNodeInput<MatchNode>
): void => {
  const targetVar = compiler.nextCompilerId();
  const matchedVar = compiler.nextCompilerId();
  const frame = parentFrame.push(true);
  compiler.emitLine('frame = frame.push(true);');
  if (compiler.streamErrorRecovery) {
    const { lineno: rawLine, colno: rawCol } = node;
    const lineno = rawLine ?? 0;
    const colno = rawCol ?? 0;
    compiler.emitLine(`let ${targetVar};`);
    compiler.emitLine(`try { ${targetVar} = `);
    compiler.compileExpression(node.expr, frame);
    compiler.emitLine('; ');
    compiler.emitStreamCatch(lineno, colno, `${targetVar} = undefined`);
  } else {
    compiler.emitLine(`let ${targetVar} = `);
    compiler.compileExpression(node.expr, frame);
    compiler.emitLine(';');
  }
  compiler.emitLine(`let ${matchedVar} = false;`);

  forEach(node.cases, (caseNode) => {
    const pattern = caseNode.pattern;
    const condParts: string[] = [];

    if (isLiteral(pattern)) {
      condParts.push(`${targetVar} === ${JSON.stringify(pattern.value)}`);
    } else if (isSymbol(pattern)) {
      const name = pattern.value;
      if (name !== '_') {
        assertSafeIdentifier(name, { compiler });
        compiler.emitLine(
          `frame = frame.set({ name: ${JSON.stringify(name)}, value: ${targetVar} });`
        );
        frame.set({ name, value: targetVar });
      }
    } else if (isArray(pattern) || isDict(pattern)) {
      condParts.push(`${targetVar} != null`);
      compileDestructuring({ compiler, frame, registerFrame: true }, pattern, targetVar);
    } else {
      const exprId = compiler.nextCompilerId();
      compiler.emitLine(`let ${exprId} = `);
      compiler.compile(pattern, frame);
      compiler.emitLine(';');
      condParts.push(`${targetVar} === ${exprId}`);
    }

    if (caseNode.guard) {
      const guardId = compiler.nextCompilerId();
      compiler.emitLine(`let ${guardId} = `);
      compiler.compile(caseNode.guard, frame);
      compiler.emitLine(';');
      condParts.push(guardId);
    }

    const cond = condParts.length > 0 ? condParts.join(' && ') : 'true';
    compiler.emitLine(`if (!${matchedVar} && (${cond})) {`);
    compiler.emitLine(`${matchedVar} = true;`);
    compiler.compile(caseNode.body, frame);
    compiler.emitLine('}');
  });

  if (node.default) {
    compiler.emitLine(`if (!${matchedVar}) {`);
    compiler.compile(node.default, frame);
    compiler.emitLine('}');
  }

  compiler.emitLine('frame = frame.pop();');
};

// WHY: WhenNode is compiled inline by compileMatch and must never reach the dispatcher directly; this stub is a defensive guard that fails loudly if dispatch routing is broken.
export const compileWhen = (compiler: Compiler, _input: CompileNodeInput<WhenNode>): void => {
  compiler.fail({
    message: 'when: WhenNode should be compiled by compileMatch, not dispatched directly',
    lineno: 0,
    colno: 0,
  });
};
