import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import type { Node, VariableDeclNode, CompoundAssignNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';
import { compileDestructuring } from './pattern.ts';

const getTargetName = (target: Node | undefined): string | null => {
  if (!target) {
    return null;
  }
  if (isSymbol(target) || typeof target?.value === 'string') {
    return target.value as string;
  }
  return null;
};

const hasPatternTarget = (node: VariableDeclNode): boolean => {
  const targets = node.targets;
  return Boolean(targets) && targets.some(t =>
    isArrayPattern(t) || isObjectPattern(t)
  );
};

const compileVariableDeclaration = (ctx: Compiler, node: VariableDeclNode, frame: Frame): void => {
  if (hasPatternTarget(node)) {
    const valueId = ctx.tmpid();
    ctx.emitLine(`let ${valueId} = `);
    ctx.compileExpression(node.value, frame);
    ctx.emitLine(';');

    for (const pattern of node.targets) {
      compileDestructuring({ ctx, frame, registerFrame: true }, pattern, valueId);
    }
  } else {
    const targets = node.targets;
    const name = getTargetName(targets[0]);
    const valueId = ctx.tmpid();

    ctx.emitLine(`let ${valueId} = `);
    ctx.compileExpression(node.value, frame);
    ctx.emitLine(';');

    if (name !== null) {
      ctx.emitLine(`frame.set("${name}", ${valueId}, true);`);
    }
  }
};

const compileVariableAssignment = (ctx: Compiler, node: VariableDeclNode, frame: Frame): void => {
  if (hasPatternTarget(node)) {
    const valueId = ctx.tmpid();
    ctx.emitLine(`let ${valueId} = `);
    ctx.compileExpression(node.value, frame);
    ctx.emitLine(';');

    for (const pattern of node.targets) {
      compileDestructuring({ ctx, frame, registerFrame: true }, pattern, valueId);
    }
  } else {
    const targets = node.targets;
    const name = getTargetName(targets[0]);

    if (name !== null) {
      ctx.emitLine(`if (frame.lookup("${name}") === undefined) { throw new ReferenceError("Variable '${name}' is not defined. Use ${name} := value to declare it."); }`);

      const valueId = ctx.tmpid();
      ctx.emitLine(`let ${valueId} = `);
      ctx.compileExpression(node.value, frame);
      ctx.emitLine(';');

      ctx.emitLine(`frame.set("${name}", ${valueId}, true);`);
    }
  }
};

const getCompoundOpJs = (operator: string): string | null => {
  switch (operator) {
    case '||=': return '||';
    case '&&=': return '&&';
    case '??=': return '??';
    case '**=': return '**';
    case '//=': return null;
    case '+=': return '+';
    case '-=': return '-';
    case '*=': return '*';
    case '/=': return '/';
    case '%=': return '%';
    default: return null;
  }
};

const compileCompoundAssignment = (ctx: Compiler, node: CompoundAssignNode, frame: Frame): void => {
  const targets = node.targets;
  const name = getTargetName(targets[0]);
  if (name === null) {
    ctx.fail('Compound assignment requires a named target', node.lineno, node.colno);
    return;
  }

  const operator = node.operator as string;
  const key = JSON.stringify(name);
  const currentId = ctx.tmpid();
  const valueId = ctx.tmpid();

  // IIFE so the read-modify-write side effect is a valid expression value
  // (mirrors compileWalrus / compileIncrementDecrement).
  emitLocationGuard(ctx, node.lineno ?? 0, node.colno ?? 0);
  ctx.emit('(() => {');
  ctx.emit(`let ${currentId} = runtime.contextOrFrameLookup(context, frame, ${key});`);

  if (operator === '//=') {
    ctx.emit(`let ${valueId} = Math.floor(${currentId} / `);
    ctx.compileExpression(node.value, frame);
    ctx.emit(');');
  } else if (operator === '|>=') {
    const valueNode = node.value;
    const filterName = valueNode.type === 'symbol' ? valueNode.value as string : null;
    const inputLocation = `${node.lineno ?? 0}, ${node.colno ?? 0}`;
    if (filterName) {
      ctx.emit(`let ${valueId} = await runtime.awaitValue(env.getFilter(${JSON.stringify(filterName)}, ${inputLocation}, ${inputLocation}, ${key}).call(context, ${currentId}));`);
    } else {
      ctx.emit(`let ${valueId} = await runtime.awaitValue(`);
      ctx.compileExpression(valueNode, frame);
      ctx.emit(`, ${currentId});`);
    }
  } else {
    const compoundOp = getCompoundOpJs(operator);
    if (compoundOp === null) {
      ctx.fail(`Unsupported compound operator: ${operator}`, node.lineno, node.colno);
    }
    ctx.emit(`let ${valueId} = ${currentId} ${compoundOp} `);
    ctx.compileExpression(node.value, frame);
    ctx.emit(';');
  }

  ctx.emit(`frame.set(${key}, ${valueId}, true);`);
  ctx.emit(`context.setVariable(${key}, ${valueId});`);
  ctx.emit(`return ${valueId};`);
  ctx.emit('})())');
};

export { compileVariableDeclaration, compileVariableAssignment, compileCompoundAssignment };
