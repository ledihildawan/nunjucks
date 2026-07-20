import { nodes } from '../../nodes/index.js';
import { compileDestructuring } from './pattern.js';

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

    ctx._emitLine('if (frame.lookup("' + name + '") === undefined) { throw new ReferenceError("Variable \'' + name + '\' is not defined"); }');

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
    ctx._emitLine('if (frame.lookup("' + name + '") === undefined) { throw new ReferenceError("Variable \'' + name + '\' is not defined"); }');

    const valueId = ctx._tmpid();
    if (node.operator === '//=') {
      ctx._emit('let ' + valueId + ' = Math.floor(frame.lookup("' + name + '") / ');
      ctx._compileExpression(node.value, frame);
      ctx._emitLine(');');
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

  ctx._emitLine('let ' + funcId + ' = runtime.makeMacro([], [], async function() {');
  const bufferId = ctx._pushBuffer();
  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });
  ctx._emitLine('return runtime.createSafeString(' + bufferId + ');');
  ctx._emitLine('});');
  ctx._popBuffer();

  ctx._emitLine('frame.set("' + name + '", ' + funcId + ', true);');
};