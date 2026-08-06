import type { MatchNode, WhenNode } from '@nunjucks/nodes';
import { isLiteral, isSymbol, isArray, isDict } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileDestructuring } from './pattern.ts';

export const compileMatch = (ctx: Compiler, node: MatchNode, parentFrame: Frame): void => {
  const targetVar = ctx.tmpid();
  const matchedVar = ctx.tmpid();
  const frame = parentFrame.push(true);
  ctx.emitLine('frame = frame.push(true);');
  ctx.emitLine(`let ${targetVar} = `);
  ctx.compileExpression(node.expr, frame);
  ctx.emitLine(';');
  ctx.emitLine(`let ${matchedVar} = false;`);

  for (const caseNode of node.cases) {
    const pattern = caseNode.pattern;
    const condParts: string[] = [];

    if (isLiteral(pattern)) {
      condParts.push(`${targetVar} === ${JSON.stringify(pattern.value)}`);
    } else if (isSymbol(pattern)) {
      const name = pattern.value as string;
      if (name !== '_') {
        ctx.emitLine(`frame.set("${name}", ${targetVar});`);
        frame.set(name, targetVar);
      }
    } else if (isArray(pattern) || isDict(pattern)) {
      condParts.push(`${targetVar} != null`);
      compileDestructuring({ ctx, frame, registerFrame: true }, pattern, targetVar);
    } else {
      const exprId = ctx.tmpid();
      ctx.emitLine(`let ${exprId} = `);
      ctx.compile(pattern, frame);
      ctx.emitLine(';');
      condParts.push(`${targetVar} === ${exprId}`);
    }

    if (caseNode.guard) {
      const guardId = ctx.tmpid();
      ctx.emitLine(`let ${guardId} = `);
      ctx.compile(caseNode.guard, frame);
      ctx.emitLine(';');
      condParts.push(guardId);
    }

    const cond = condParts.length > 0 ? condParts.join(' && ') : 'true';
    ctx.emitLine(`if (!${matchedVar} && (${cond})) {`);
    ctx.emitLine(`${matchedVar} = true;`);
    ctx.compile(caseNode.body, frame);
    ctx.emitLine('}');
  }

  if (node.default) {
    ctx.emitLine(`if (!${matchedVar}) {`);
    ctx.compile(node.default, frame);
    ctx.emitLine('}');
  }

  ctx.emitLine('frame = frame.pop();');
};

export const compileWhen = (ctx: Compiler, _node: WhenNode, _frame: Frame): void => {
  ctx.fail('when: WhenNode should be compiled by compileMatch, not dispatched directly', 0, 0);
};
