import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import type { MacroArgument, Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
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

const hasPatternTarget = (node: Node): boolean => {
  const targets = node.targets as Node[];
  return Boolean(targets) && targets.some(t =>
    isArrayPattern(t) || isObjectPattern(t)
  );
};

const compileVariableDeclaration = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (hasPatternTarget(node)) {
    const valueId = ctx.tmpid();
    ctx.emitLine(`let ${valueId} = `);
    ctx.compileExpression(node.value as Node, frame);
    ctx.emitLine(';');

    forEach(node.targets as Node[], pattern => {
      compileDestructuring({ ctx, frame, registerFrame: true }, pattern, valueId);
    });
  } else {
    const targets = node.targets as Node[];
    const name = getTargetName(targets[0]);
    const valueId = ctx.tmpid();

    ctx.emitLine(`let ${valueId} = `);
    ctx.compileExpression(node.value as Node, frame);
    ctx.emitLine(';');

    if (name !== null) {
      ctx.emitLine(`frame.set("${name}", ${valueId}, true);`);
    }
  }
};

const compileVariableAssignment = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (hasPatternTarget(node)) {
    const valueId = ctx.tmpid();
    ctx.emitLine(`let ${valueId} = `);
    ctx.compileExpression(node.value as Node, frame);
    ctx.emitLine(';');

    forEach(node.targets as Node[], pattern => {
      compileDestructuring({ ctx, frame, registerFrame: true }, pattern, valueId);
    });
  } else {
    const targets = node.targets as Node[];
    const name = getTargetName(targets[0]);

    if (name !== null) {
      ctx.emitLine(`if (frame.lookup("${name}") === undefined) { throw new ReferenceError("Variable '${name}' is not defined. Use ${name} := value to declare it."); }`);

      const valueId = ctx.tmpid();
      ctx.emitLine(`let ${valueId} = `);
      ctx.compileExpression(node.value as Node, frame);
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

const compileCompoundAssignment = (ctx: Compiler, node: Node, frame: Frame): void => {
  const targets = node.targets as Node[];
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
  ctx.emit(`(lineno = ${node.lineno ?? 0}, colno = ${node.colno ?? 0}, (() => {`);
  ctx.emit(`let ${currentId} = runtime.contextOrFrameLookup(context, frame, ${key});`);

  if (operator === '//=') {
    ctx.emit(`let ${valueId} = Math.floor(${currentId} / `);
    ctx.compileExpression(node.value as Node, frame);
    ctx.emit(');');
  } else if (operator === '|>=') {
    const valueNode = node.value as Node;
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
    ctx.emit(`let ${valueId} = ${currentId} ${getCompoundOpJs(operator)} `);
    ctx.compileExpression(node.value as Node, frame);
    ctx.emit(';');
  }

  ctx.emit(`frame.set(${key}, ${valueId}, true);`);
  ctx.emit(`context.setVariable(${key}, ${valueId});`);
  ctx.emit(`return ${valueId};`);
  ctx.emit('})())');
};

const buildMacroParams = (args: MacroArgument[]): { argNames: string[]; hasDefaults: boolean; paramNames: string[]; realParams: string[] } => {
  const argNames = args.map(a => `"${a.name}"`);
  const hasDefaults = args.some(a => a.defaultVal !== null);
  const paramNames = args.map(a => `l_${a.name}`);
  const realParams = hasDefaults ? [...paramNames, 'kwargs'] : paramNames;
  return { argNames, hasDefaults, paramNames, realParams };
};

const emitMacroBody = (
  ctx: Compiler,
  args: MacroArgument[],
  hasDefaults: boolean,
  paramNames: string[],
  node: Node,
  frame: Frame
): void => {
  ctx.emitLine('let callerFrame = frame;');
  ctx.emitLine('frame = frame.push(true);');

  if (hasDefaults) {
    ctx.emitLine('kwargs = kwargs || {};');
    args.forEach((arg, i) => {
      const argObj = arg;
      if (argObj.defaultVal) {
        const paramVal = paramNames[i];
        ctx.emit(`let ${argObj.name} = `);
        if (paramVal === undefined) {
          ctx.emit('(');
          ctx.compile(argObj.defaultVal, frame);
          ctx.emit(')');
        } else {
          ctx.emit(`${paramVal}`);
        }
        ctx.emit(';');
      } else {
        ctx.emitLine(`let ${argObj.name} = ${paramNames[i]};`);
      }
      ctx.emitLine(`frame.set("${argObj.name}", ${argObj.name});`);
    });
  } else {
    forEach(args, arg => {
      const argObj = arg;
      ctx.emitLine(`let ${argObj.name} = l_${argObj.name};`);
      ctx.emitLine(`frame.set("${argObj.name}", ${argObj.name});`);
    });
  }

  const bufferId = ctx.pushBuffer();
  ctx.withScopedSyntax(() => {
    ctx.compile(node.body as Node, frame);
  });
  ctx.emitLine('frame = callerFrame;');
  ctx.emitLine(`return runtime.createSafeString(${bufferId});`);
  ctx.emitLine('});');
  ctx.popBuffer();
};

const compileDefineBlock = (ctx: Compiler, node: Node, frame: Frame): void => {
  const name = node.name as string;
  const funcId = ctx.tmpid();
  const args = node.args as MacroArgument[];
  const { argNames, hasDefaults, paramNames, realParams } = buildMacroParams(args);

  ctx.emitLine(`let ${funcId} = runtime.makeMacro([${argNames.join(', ')}], [], async (${realParams.join(', ')}) => {`);
  emitMacroBody(ctx, args, hasDefaults, paramNames, node, frame);
  ctx.emitLine(`frame.set("${name}", ${funcId}, true);`);
};

export { compileVariableDeclaration, compileVariableAssignment, compileCompoundAssignment, compileDefineBlock };
