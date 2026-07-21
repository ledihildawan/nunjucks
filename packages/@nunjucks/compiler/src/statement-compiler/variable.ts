import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileDestructuring } from './pattern.ts';

const getTargetName = (target: Node): string | null => {
  if (nodes.isSymbol(target) || typeof target?.value === 'string') {
    return target.value as string;
  }
  return null;
};

const hasPatternTarget = (node: Node): boolean => {
  const targets = node.targets as Node[];
  return !!targets && targets.some(t =>
    nodes.isArrayPattern(t) || nodes.isObjectPattern(t)
  );
};

export const compileVariableDeclaration = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (hasPatternTarget(node)) {
    const valueId = ctx._tmpid();
    ctx._emitLine('let ' + valueId + ' = ');
    ctx._compileExpression(node.value as Node, frame);
    ctx._emitLine(';');

    (node.targets as Node[]).forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
    });
  } else {
    const name = getTargetName((node.targets as Node[])[0]!);
    const valueId = ctx._tmpid();

    ctx._emitLine('let ' + valueId + ' = ');
    ctx._compileExpression(node.value as Node, frame);
    ctx._emitLine(';');

    ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
  }
};

export const compileVariableAssignment = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (hasPatternTarget(node)) {
    const valueId = ctx._tmpid();
    ctx._emitLine('let ' + valueId + ' = ');
    ctx._compileExpression(node.value as Node, frame);
    ctx._emitLine(';');

    (node.targets as Node[]).forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
    });
  } else {
    const name = getTargetName((node.targets as Node[])[0]!);

    ctx._emitLine('if (frame.lookup("' + name + '") === undefined) { throw new ReferenceError("Variable \'' + name + '\' is not defined. Use ' + name + ' := value to declare it."); }');

    const valueId = ctx._tmpid();
    ctx._emitLine('let ' + valueId + ' = ');
    ctx._compileExpression(node.value as Node, frame);
    ctx._emitLine(';');

    ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
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

export const compileCompoundAssignment = (ctx: Compiler, node: Node, frame: Frame): void => {
  const jsOp = getCompoundOpJs(node.operator as string);

  if (hasPatternTarget(node)) {
    const valueId = ctx._tmpid();
    const targetName = getTargetName((node.targets as Node[])[0]!);

    if (node.operator === '//=') {
      ctx._emitLine('let ' + valueId + ' = Math.floor(frame.lookup("' + targetName + '") / ');
      ctx._compileExpression(node.value as Node, frame);
      ctx._emitLine('));');
    } else {
      ctx._emitLine('let ' + valueId + ' = ');
      ctx._emit('frame.lookup("' + targetName + '") ' + jsOp + ' ');
      ctx._compileExpression(node.value as Node, frame);
      ctx._emitLine(';');
    }

    (node.targets as Node[]).forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
    });
  } else {
    const name = getTargetName((node.targets as Node[])[0]!);

    ctx._emitLine('{');
    ctx._emitLine('if (frame.lookup("' + name + '") === undefined) { throw new ReferenceError("Variable \'' + name + '\' is not defined. Use ' + name + ' := value to declare it."); }');

    const valueId = ctx._tmpid();
    if (node.operator === '//=') {
      ctx._emit('let ' + valueId + ' = Math.floor(frame.lookup("' + name + '") / ');
      ctx._compileExpression(node.value as Node, frame);
      ctx._emitLine(');');
    } else if (node.operator === '|>=') {
      const valueNode = node.value as Node;
      const filterName = valueNode.type === 'symbol' ? (valueNode.value as string) : null;
      const inputLocation = `${node.lineno ?? 0}, ${node.colno ?? 0}`;
      if (filterName) {
        ctx._emit('let ' + valueId + ' = await runtime.awaitValue(env.getFilter("' + filterName + '", ' + inputLocation + ', ' + inputLocation + ', "' + name + '").call(context, ');
        ctx._emit('frame.lookup("' + name + '")');
        ctx._emitLine('))');
      } else {
        ctx._emit('let ' + valueId + ' = await runtime.awaitValue(');
        ctx._compileExpression(valueNode, frame);
        ctx._emit(', frame.lookup("' + name + '"))');
      }
    } else {
      ctx._emit('let ' + valueId + ' = frame.lookup("' + name + '") ' + jsOp + ' ');
      ctx._compileExpression(node.value as Node, frame);
      ctx._emitLine(';');
    }

    ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
    ctx._emitLine('}');
  }
};

export const compileDefineBlock = (ctx: Compiler, node: Node, frame: Frame): void => {
  const name = node.name as string;
  const funcId = ctx._tmpid();
  const args = (node.args as Node[]) || [];

  const argNames = args.map(a => `"${(a as unknown as { name: string }).name}"`);
  const hasDefaults = args.some(a => (a as unknown as { defaultVal: unknown }).defaultVal !== null);
  const paramNames = args.map((a, i) => `l_${(a as unknown as { name: string }).name}`);
  const realParams = hasDefaults ? [...paramNames, 'kwargs'] : paramNames;

  ctx._emitLine(`let ${funcId} = runtime.makeMacro([${argNames.join(', ')}], [], async (${realParams.join(', ')}) => {`);

  ctx._emitLine('let callerFrame = frame;');
  ctx._emitLine('frame = frame.push(true);');

  if (hasDefaults) {
    ctx._emitLine('kwargs = kwargs || {};');
    args.forEach((arg, i) => {
      const argObj = arg as unknown as { name: string; defaultVal: Node | null };
      if (argObj.defaultVal) {
        ctx._emit(`let ${argObj.name} = ${paramNames[i]} !== undefined ? ${paramNames[i]} : (`);
        ctx.compile(argObj.defaultVal, frame);
        ctx._emit(');');
      } else {
        ctx._emitLine(`let ${argObj.name} = ${paramNames[i]};`);
      }
      ctx._emitLine(`frame.set("${argObj.name}", ${argObj.name});`);
    });
  } else {
    args.forEach((arg) => {
      const argObj = arg as unknown as { name: string };
      ctx._emitLine(`let ${argObj.name} = l_${argObj.name};`);
      ctx._emitLine(`frame.set("${argObj.name}", ${argObj.name});`);
    });
  }

  const bufferId = ctx._pushBuffer();
  ctx._withScopedSyntax(() => {
    ctx.compile(node.body as Node, frame);
  });
  ctx._emitLine('frame = callerFrame;');
  ctx._emitLine('return runtime.createSafeString(' + bufferId + ');');
  ctx._emitLine('});');
  ctx._popBuffer();

  ctx._emitLine('frame.set("' + name + '", ' + funcId + ', true);');
};
