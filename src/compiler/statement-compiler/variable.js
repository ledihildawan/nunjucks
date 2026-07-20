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

export const compileCompoundAssignment = (ctx, node, frame) => {
  if (hasPatternTarget(node)) {
    const valueId = ctx._tmpid();
    const targetName = getTargetName(node.targets[0]);

    ctx._emitLine('let ' + valueId + ' = ');
    ctx._emit('frame.lookup("' + targetName + '") ' + node.operator.replace('=', '') + ' ');
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
    ctx._emit('frame.lookup("' + name + '") ' + node.operator.replace('=', '') + ' ');
    ctx._compileExpression(node.value, frame);
    ctx._emitLine(';');

    ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
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