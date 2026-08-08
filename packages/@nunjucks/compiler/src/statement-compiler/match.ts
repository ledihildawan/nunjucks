import { forEach } from 'remeda';
import type { MatchNode, WhenNode } from '@nunjucks/nodes';
import { isLiteral, isSymbol, isArray, isDict } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileDestructuring } from './pattern.ts';

export const compileMatch = (compiler: Compiler, node: MatchNode, parentFrame: Frame): void => {
  const targetVar = compiler.tmpid();
  const matchedVar = compiler.tmpid();
  const frame = parentFrame.push(true);
  compiler.emitLine('frame = frame.push(true);');
  compiler.emitLine(`let ${targetVar} = `);
  compiler.compileExpression(node.expr, frame);
  compiler.emitLine(';');
  compiler.emitLine(`let ${matchedVar} = false;`);

  forEach(node.cases, (caseNode) => {
    const pattern = caseNode.pattern;
    const condParts: string[] = [];

    if (isLiteral(pattern)) {
      condParts.push(`${targetVar} === ${JSON.stringify(pattern.value)}`);
    } else if (isSymbol(pattern)) {
      const name = pattern.value;
      if (name !== '_') {
        compiler.emitLine(`frame.set("${name}", ${targetVar});`);
        frame.set(name, targetVar);
      }
    } else if (isArray(pattern) || isDict(pattern)) {
      condParts.push(`${targetVar} != null`);
      compileDestructuring({ ctx: compiler, frame, registerFrame: true }, pattern, targetVar);
    } else {
      const exprId = compiler.tmpid();
      compiler.emitLine(`let ${exprId} = `);
      compiler.compile(pattern, frame);
      compiler.emitLine(';');
      condParts.push(`${targetVar} === ${exprId}`);
    }

    if (caseNode.guard) {
      const guardId = compiler.tmpid();
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
export const compileWhen = (compiler: Compiler, _node: WhenNode, _frame: Frame): void => {
  compiler.fail('when: WhenNode should be compiled by compileMatch, not dispatched directly', 0, 0);
};
