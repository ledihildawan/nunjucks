import { nodes } from '../../nodes/index.js';
import { compileDestructuring } from '../statement-compiler/pattern.js';

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
  const valueId = ctx._tmpid();

  ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => {');
  ctx._emit('let ' + valueId + ' = ');
  ctx.compile(node.value, frame);
  ctx._emit(';');
  if (nodes.isSymbol(node.target)) {
    ctx._emit('frame.set(' + JSON.stringify(node.target.value) + ', ' + valueId + ', true);');
  } else if (nodes.isArrayPattern(node.target) || nodes.isObjectPattern(node.target)) {
    compileDestructuring(ctx, frame, node.target, valueId, false);
  } else {
    ctx.fail('Walrus target must be a symbol or destructuring pattern', node.lineno, node.colno);
  }
  ctx._emit('return ' + valueId + ';');
  ctx._emit('})())');
};
