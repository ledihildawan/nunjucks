import { isLiteral, isLookupVal, isSlice, isSymbol } from '@nunjucks/nodes';
import type { Node, LookupNode, SliceNode, CallNode, NodeLocation } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';
import { compileAggregate } from './container.ts';

const locationFor = (node: Node | undefined, fallback: Node): NodeLocation => ({
  lineno: node?.lineno ?? fallback.lineno,
  colno: node?.colno ?? fallback.colno
});

const getTargetName = (node: Node | undefined): string | null => {
  if (!node) { return null; }
  if (isSymbol(node)) { return node.value; }
  if (isLookupVal(node)) {
    const parentName = getTargetName(node.target);
    const val = node.val;
    const propName: unknown = isLiteral(val) ? val.value : null;
    if (parentName && propName) { return `${parentName}.${propName}`; }
  }
  return null;
};

const emitSlice = (ctx: Compiler, val: SliceNode, node: LookupNode, frame: Frame): void => {
  ctx.emit('runtime.slice((');
  ctx.compileExpression(node.target, frame);
  ctx.emit('), ');
  if (val.start) { ctx.compileExpression(val.start, frame); } else { ctx.emit('null'); }
  ctx.emit(', ');
  if (val.stop) { ctx.compileExpression(val.stop, frame); } else { ctx.emit('null'); }
  ctx.emit(', ');
  if (val.step) { ctx.compileExpression(val.step, frame); } else { ctx.emit('null'); }
  ctx.emit(')');
};

const emitMemberLookup = (ctx: Compiler, node: LookupNode, val: Node, frame: Frame): void => {
  const parentName = getTargetName(node.target);
  ctx.emit('runtime.memberLookup((');
  ctx.compileExpression(node.target, frame);
  ctx.emit('),');
  ctx.compileExpression(val, frame);
  if (parentName === null) {
    ctx.emit(', null');
  } else {
    ctx.emit(`, ${JSON.stringify(parentName)}`);
  }
  ctx.emit(')');
};

export const compileLookupVal = (ctx: Compiler, node: LookupNode, frame: Frame): void => {
  const val = node.val;
  const location = locationFor(val, node);
  emitLocationGuard(ctx, location.lineno, location.colno);

  if (isSlice(val)) {
    emitSlice(ctx, val, node, frame);
  } else {
    emitMemberLookup(ctx, node, val, frame);
  }

  ctx.emit(')');
};

export const compileOptionalChain = (ctx: Compiler, node: LookupNode, frame: Frame): void => {
  const loc = locationFor(node.val, node);
  emitLocationGuard(ctx, loc.lineno, loc.colno);
  ctx.emit('runtime.optionalMemberLookup((');
  ctx.compileExpression(node.target, frame);
  ctx.emit('),');
  ctx.compileExpression(node.val, frame);
  ctx.emit(')');
  ctx.emit(')');
};

export const compileOptionalCall = (ctx: Compiler, node: CallNode, frame: Frame): void => {
  ctx.emit('((');
  ctx.compileExpression(node.name, frame);
  ctx.emit(') == null ? undefined : ');
  ctx.compileExpression(node.name, frame);
  ctx.emit('(');
  compileAggregate(ctx, node, frame, { startChar: '', endChar: ')' });
  ctx.emit(')');
};

export const compileSlice = (ctx: Compiler, node: SliceNode, frame: Frame): void => {
  const loc = locationFor(node, node);
  emitLocationGuard(ctx, loc.lineno, loc.colno);
  ctx.emit('runtime.slice((');
  if (node.start) { ctx.compileExpression(node.start, frame); } else { ctx.emit('null'); }
  ctx.emit('), (');
  if (node.stop) { ctx.compileExpression(node.stop, frame); } else { ctx.emit('null'); }
  ctx.emit('), (');
  if (node.step) { ctx.compileExpression(node.step, frame); } else { ctx.emit('null'); }
  ctx.emit('))');
  ctx.emit(')');
};
