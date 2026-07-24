import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
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

export const compileVariableDeclaration = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (hasPatternTarget(node)) {
    const valueId = ctx.tmpid();
    ctx.emitLine(`let ${valueId} = `);
    ctx.compileExpression(node.value as Node, frame);
    ctx.emitLine(';');

    (node.targets as Node[]).forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
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

export const compileVariableAssignment = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (hasPatternTarget(node)) {
    const valueId = ctx.tmpid();
    ctx.emitLine(`let ${valueId} = `);
    ctx.compileExpression(node.value as Node, frame);
    ctx.emitLine(';');

    (node.targets as Node[]).forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
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

export const compileCompoundAssignment = (ctx: Compiler, node: Node, frame: Frame): void => {
  const jsOp = getCompoundOpJs(node.operator as string);

  if (hasPatternTarget(node)) {
    const valueId = ctx.tmpid();
    const targets = node.targets as Node[];
    const targetName = getTargetName(targets[0]);

    if (node.operator === '//=') {
      ctx.emitLine(`let ${valueId} = Math.floor(frame.lookup("${targetName}") / `);
      ctx.compileExpression(node.value as Node, frame);
      ctx.emitLine('));');
    } else {
      ctx.emitLine(`let ${valueId} = `);
      ctx.emit(`frame.lookup("${targetName}") ${jsOp} `);
      ctx.compileExpression(node.value as Node, frame);
      ctx.emitLine(';');
    }

    (node.targets as Node[]).forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
    });
  } else {
    const targets = node.targets as Node[];
    const name = getTargetName(targets[0]);

    if (name === null) {
      return;
    }

    ctx.emitLine('{');
    ctx.emitLine(`if (frame.lookup("${name}") === undefined) { throw new ReferenceError("Variable '${name}' is not defined. Use ${name} := value to declare it."); }`);

    const valueId = ctx.tmpid();
    if (node.operator === '//=') {
      ctx.emit(`let ${valueId} = Math.floor(frame.lookup("${name}") / `);
      ctx.compileExpression(node.value as Node, frame);
      ctx.emitLine(');');
    } else if (node.operator === '|>=') {
      const valueNode = node.value as Node;
      let filterName: string | null;
      if (valueNode.type === 'symbol') {
        filterName = valueNode.value as string;
      } else {
        filterName = null;
      }
      const inputLocation = `${node.lineno ?? 0}, ${node.colno ?? 0}`;
      if (filterName) {
        ctx.emit(`let ${valueId} = await runtime.awaitValue(env.getFilter("${filterName}", ${inputLocation}, ${inputLocation}, "${name}").call(context, `);
        ctx.emit(`frame.lookup("${name}")`);
        ctx.emitLine('))');
      } else {
        ctx.emit(`let ${valueId} = await runtime.awaitValue(`);
        ctx.compileExpression(valueNode, frame);
        ctx.emit(`, frame.lookup("${name}"))`);
      }
    } else {
      ctx.emit(`let ${valueId} = frame.lookup("${name}") ${jsOp} `);
      ctx.compileExpression(node.value as Node, frame);
      ctx.emitLine(';');
    }

    ctx.emitLine(`frame.set("${name}", ${valueId}, true);`);
    ctx.emitLine('}');
  }
};

export const compileDefineBlock = (ctx: Compiler, node: Node, frame: Frame): void => {
  const name = node.name as string;
  const funcId = ctx.tmpid();
  const args = (node.args as Node[]) || [];

  const argNames = args.map(a => `"${(a as unknown as { name: string }).name}"`);
  const hasDefaults = args.some(a => (a as unknown as { defaultVal: unknown }).defaultVal !== null);
  const paramNames = args.map((a, _i) => `l_${(a as unknown as { name: string }).name}`);
  let realParams: string[];
  if (hasDefaults) {
    realParams = [...paramNames, 'kwargs'];
  } else {
    realParams = paramNames;
  }

  ctx.emitLine(`let ${funcId} = runtime.makeMacro([${argNames.join(', ')}], [], async (${realParams.join(', ')}) => {`);

  ctx.emitLine('let callerFrame = frame;');
  ctx.emitLine('frame = frame.push(true);');

  if (hasDefaults) {
    ctx.emitLine('kwargs = kwargs || {};');
    args.forEach((arg, i) => {
      const argObj = arg as unknown as { name: string; defaultVal: Node | null };
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
    args.forEach((arg) => {
      const argObj = arg as unknown as { name: string };
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

  ctx.emitLine(`frame.set("${name}", ${funcId}, true);`);
};
