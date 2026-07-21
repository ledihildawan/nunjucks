import { nodes } from '@nunjucks/nodes';
import { compileDestructuring } from './pattern.ts';

const getTargetName = (target) => {
  if (nodes.isSymbol(target) || typeof target?.value === 'string') {
    return target.value;
  }
  return null;
};

const hasPatternTarget = (node) => {
  return node.targets && node.targets.some(t =>
    nodes.isArrayPattern(t) || nodes.isObjectPattern(t)
  );
};

export const compileVariableDeclaration = (ctx, node, frame) => {
  if (hasPatternTarget(node)) {
    const valueId = ctx._tmpid();
    ctx._emitLine('let ' + valueId + ' = ');
    ctx._compileExpression(node.value, frame);
    ctx._emitLine(';');

    node.targets.forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
    });
  } else {
    const name = getTargetName(node.targets[0]);
    const valueId = ctx._tmpid();

    ctx._emitLine('let ' + valueId + ' = ');
    ctx._compileExpression(node.value, frame);
    ctx._emitLine(';');

    ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
  }
};

export const compileVariableAssignment = (ctx, node, frame) => {
  if (hasPatternTarget(node)) {
    const valueId = ctx._tmpid();
    ctx._emitLine('let ' + valueId + ' = ');
    ctx._compileExpression(node.value, frame);
    ctx._emitLine(';');

    node.targets.forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
    });
  } else {
    const name = getTargetName(node.targets[0]);

    ctx._emitLine('if (frame.lookup("' + name + '") === undefined) { throw new ReferenceError("Variable \'' + name + '\' is not defined. Use ' + name + ' := value to declare it."); }');

    const valueId = ctx._tmpid();
    ctx._emitLine('let ' + valueId + ' = ');
    ctx._compileExpression(node.value, frame);
    ctx._emitLine(';');

    ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
  }
};

const getCompoundOpJs = (operator) => {
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

export const compileCompoundAssignment = (ctx, node, frame) => {
  const jsOp = getCompoundOpJs(node.operator);

  if (hasPatternTarget(node)) {
    const valueId = ctx._tmpid();
    const targetName = getTargetName(node.targets[0]);

    if (node.operator === '//=') {
      ctx._emitLine('let ' + valueId + ' = Math.floor(frame.lookup("' + targetName + '") / ');
      ctx._compileExpression(node.value, frame);
      ctx._emitLine('));');
    } else {
      ctx._emitLine('let ' + valueId + ' = ');
      ctx._emit('frame.lookup("' + targetName + '") ' + jsOp + ' ');
      ctx._compileExpression(node.value, frame);
      ctx._emitLine(';');
    }

    node.targets.forEach(pattern => {
      compileDestructuring(ctx, frame, pattern, valueId);
    });
  } else {
    const name = getTargetName(node.targets[0]);

    ctx._emitLine('{');
    ctx._emitLine('if (frame.lookup("' + name + '") === undefined) { throw new ReferenceError("Variable \'' + name + '\' is not defined. Use ' + name + ' := value to declare it."); }');

    const valueId = ctx._tmpid();
    if (node.operator === '//=') {
      ctx._emit('let ' + valueId + ' = Math.floor(frame.lookup("' + name + '") / ');
      ctx._compileExpression(node.value, frame);
      ctx._emitLine(');');
    } else if (node.operator === '|>=') {
      const filterName = node.value.type === 'symbol' ? node.value.value : null;
      const inputLocation = `${node.lineno ?? 0}, ${node.colno ?? 0}`;
      if (filterName) {
        ctx._emit('let ' + valueId + ' = await runtime.awaitValue(env.getFilter("' + filterName + '", ' + inputLocation + ', ' + inputLocation + ', "' + name + '").call(context, ');
        ctx._emit('frame.lookup("' + name + '")');
        ctx._emitLine('))');
      } else {
        ctx._emit('let ' + valueId + ' = await runtime.awaitValue(');
        ctx._compileExpression(node.value, frame);
        ctx._emit(', frame.lookup("' + name + '"))');
      }
    } else {
      ctx._emit('let ' + valueId + ' = frame.lookup("' + name + '") ' + jsOp + ' ');
      ctx._compileExpression(node.value, frame);
      ctx._emitLine(';');
    }

    ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
    ctx._emitLine('}');
  }
};

export const compileDefineBlock = (ctx, node, frame) => {
  const name = node.name;
  const funcId = ctx._tmpid();
  const args = node.args || [];

  const argNames = args.map(a => `"${a.name}"`);
  const hasDefaults = args.some(a => a.defaultVal !== null);
  const paramNames = args.map((a, i) => `l_${a.name}`);
  const realParams = hasDefaults ? [...paramNames, 'kwargs'] : paramNames;

  ctx._emitLine(`let ${funcId} = runtime.makeMacro([${argNames.join(', ')}], [], async (${realParams.join(', ')}) => {`);

  ctx._emitLine('let callerFrame = frame;');
  ctx._emitLine('frame = frame.push(true);');

  if (hasDefaults) {
    ctx._emitLine('kwargs = kwargs || {};');
    args.forEach((arg, i) => {
      if (arg.defaultVal) {
        ctx._emit(`let ${arg.name} = ${paramNames[i]} !== undefined ? ${paramNames[i]} : (`);
        ctx.compile(arg.defaultVal, frame);
        ctx._emit(');');
      } else {
        ctx._emitLine(`let ${arg.name} = ${paramNames[i]};`);
      }
      ctx._emitLine(`frame.set("${arg.name}", ${arg.name});`);
    });
  } else {
    args.forEach((arg) => {
      ctx._emitLine(`let ${arg.name} = l_${arg.name};`);
      ctx._emitLine(`frame.set("${arg.name}", ${arg.name});`);
    });
  }

  const bufferId = ctx._pushBuffer();
  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });
  ctx._emitLine('frame = callerFrame;');
  ctx._emitLine('return runtime.createSafeString(' + bufferId + ');');
  ctx._emitLine('});');
  ctx._popBuffer();

  ctx._emitLine('frame.set("' + name + '", ' + funcId + ', true);');
};