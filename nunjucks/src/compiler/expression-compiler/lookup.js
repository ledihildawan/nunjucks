import { Slice } from '../../nodes/index.js';

export const compileLookupVal = (ctx, node, frame) => {
  if (node.val?.typename === 'Slice') {
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
    ctx._emit('runtime.memberLookup((');
    ctx._compileExpression(node.target, frame);
    ctx._emit('),');
    ctx._compileExpression(node.val, frame);
    ctx._emit(')');
  }
};

export const compileOptionalChain = (ctx, node, frame) => {
  ctx._emit('runtime.optionalMemberLookup((');
  ctx._compileExpression(node.target, frame);
  ctx._emit('),');
  ctx._compileExpression(node.val, frame);
  ctx._emit(')');
};

export const compileSlice = (ctx, node, frame) => {
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
};
