import { nodes } from '../../nodes/index.js';
import { compileAggregate } from './container.js';

const locationFor = (node, fallback = node) => ({
  lineno: node?.lineno ?? fallback?.lineno ?? 0,
  colno: node?.colno ?? fallback?.colno ?? 0
});

const emitLocationGuard = (ctx, location) => {
  ctx._emit('(lineno = ' + location.lineno + ', colno = ' + location.colno + ', ');
};

const getTargetName = (node) => {
  if (!node) return null;
  if (nodes.isSymbol(node)) return node.value;
  if (nodes.isLookupVal(node)) {
    const parentName = getTargetName(node.target);
    const propName = nodes.isLiteral(node.val) ? node.val.value : null;
    if (parentName && propName) return `${parentName}.${propName}`;
  }
  return null;
};

export const compileLookupVal = (ctx, node, frame) => {
  const location = locationFor(node.val, node);
  emitLocationGuard(ctx, location);

  if (nodes.isSlice(node.val)) {
    ctx._emit('runtime.slice((');
    ctx._compileExpression(node.target, frame);
    ctx._emit('), ');
    if (node.val.start) {
      ctx._compileExpression(node.val.start, frame);
    } else {
      ctx._emit('null');
    }
    ctx._emit(', ');
    if (node.val.stop) {
      ctx._compileExpression(node.val.stop, frame);
    } else {
      ctx._emit('null');
    }
    ctx._emit(', ');
    if (node.val.step) {
      ctx._compileExpression(node.val.step, frame);
    } else {
      ctx._emit('null');
    }
    ctx._emit(')');
  } else {
    const parentName = getTargetName(node.target);
    ctx._emit('runtime.memberLookup((');
    ctx._compileExpression(node.target, frame);
    ctx._emit('),');
    ctx._compileExpression(node.val, frame);
    if (parentName !== null) {
      ctx._emit(`, ${JSON.stringify(parentName)}`);
    } else {
      ctx._emit(', null');
    }
    ctx._emit(')');
  }

  ctx._emit(')');
};

export const compileOptionalChain = (ctx, node, frame) => {
  emitLocationGuard(ctx, locationFor(node.val, node));
  ctx._emit('runtime.optionalMemberLookup((');
  ctx._compileExpression(node.target, frame);
  ctx._emit('),');
  ctx._compileExpression(node.val, frame);
  ctx._emit(')');
  ctx._emit(')');
};

export const compileOptionalCall = (ctx, node, frame) => {
  ctx._emit('((');
  ctx._compileExpression(node.name, frame);
  ctx._emit(') == null ? undefined : ');
  ctx._compileExpression(node.name, frame);
  ctx._emit('(');
  compileAggregate(ctx, node.args, frame, '', ')');
  ctx._emit(')');
};

export const compileSlice = (ctx, node, frame) => {
  emitLocationGuard(ctx, locationFor(node));
  ctx._emit('runtime.slice((');
  if (node.start) {
    ctx._compileExpression(node.start, frame);
  } else {
    ctx._emit('null');
  }
  ctx._emit('), (');
  if (node.stop) {
    ctx._compileExpression(node.stop, frame);
  } else {
    ctx._emit('null');
  }
  ctx._emit('), (');
  if (node.step) {
    ctx._compileExpression(node.step, frame);
  } else {
    ctx._emit('null');
  }
  ctx._emit('))');
  ctx._emit(')');
};
