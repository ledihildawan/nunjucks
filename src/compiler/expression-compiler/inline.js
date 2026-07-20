import { nodes } from '../../nodes/index.js';

export const compileInlineIf = (ctx, node, frame) => {
  ctx._emit('(');
  ctx.compile(node.cond, frame);
  ctx._emit('?');
  ctx.compile(node.body, frame);
  ctx._emit(':');
  if (node.else_ !== null) {
    ctx.compile(node.else_, frame);
  } else {
    ctx._emit('""');
  }
  ctx._emit(')');
};

export const compileWalrus = (ctx, node, frame) => {
  const targetName = node.target.value;
  const id = ctx._tmpid();

  ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => {');
  ctx._emit('let ' + id + ' = ');
  ctx.compile(node.value, frame);
  ctx._emit(';');
  ctx._emit('frame.set("' + targetName + '", ' + id + ', true);');
  ctx._emit('return ' + id + ';');
  ctx._emit('})())');
};
