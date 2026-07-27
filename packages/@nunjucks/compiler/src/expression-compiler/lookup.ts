import { isLiteral, isLookupVal, isSlice, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileAggregate } from './container.ts';

const locationFor = (node: Node | undefined, fallback: Node = node as Node): { lineno: number; colno: number } => ({
  lineno: node?.lineno ?? fallback?.lineno ?? 0,
  colno: node?.colno ?? fallback?.colno ?? 0
});

const emitLocationGuard = (ctx: Compiler, location: { lineno: number; colno: number }): void => {
  ctx.emit(`(lineno = ${location.lineno}, colno = ${location.colno}, `);
};

const getTargetName = (node: Node | undefined): string | null => {
  if (!node) { return null; }
  if (isSymbol(node)) { return node.value as string; }
  if (isLookupVal(node)) {
    const parentName = getTargetName(node.target as Node);
    const val = node.val as Node;
    let propName: unknown;
    if (isLiteral(val)) {
      propName = val.value as unknown;
    } else {
      propName = null;
    }
    if (parentName && propName) { return `${parentName}.${propName}`; }
  }
  return null;
};

const emitSlice = (ctx: Compiler, val: Node, node: Node, frame: Frame): void => {
  ctx.emit('runtime.slice((');
  ctx.compileExpression(node.target as Node, frame);
  ctx.emit('), ');
  if (val.start) {
    ctx.compileExpression(val.start as Node, frame);
  } else {
    ctx.emit('null');
  }
  ctx.emit(', ');
  if (val.stop) {
    ctx.compileExpression(val.stop as Node, frame);
  } else {
    ctx.emit('null');
  }
  ctx.emit(', ');
  if (val.step) {
    ctx.compileExpression(val.step as Node, frame);
  } else {
    ctx.emit('null');
  }
  ctx.emit(')');
};

const emitMemberLookup = (ctx: Compiler, node: Node, val: Node, frame: Frame): void => {
  const parentName = getTargetName(node.target as Node);
  ctx.emit('runtime.memberLookup((');
  ctx.compileExpression(node.target as Node, frame);
  ctx.emit('),');
  ctx.compileExpression(val, frame);
  if (parentName === null) {
    ctx.emit(', null');
  } else {
    ctx.emit(`, ${JSON.stringify(parentName)}`);
  }
  ctx.emit(')');
};

export const compileLookupVal = (ctx: Compiler, node: Node, frame: Frame): void => {
  const val = node.val as Node;
  const location = locationFor(val, node);
  emitLocationGuard(ctx, location);

  if (isSlice(val)) {
    emitSlice(ctx, val, node, frame);
  } else {
    emitMemberLookup(ctx, node, val, frame);
  }

  ctx.emit(')');
};

export const compileOptionalChain = (ctx: Compiler, node: Node, frame: Frame): void => {
  emitLocationGuard(ctx, locationFor(node.val as Node, node));
  ctx.emit('runtime.optionalMemberLookup((');
  ctx.compileExpression(node.target as Node, frame);
  ctx.emit('),');
  ctx.compileExpression(node.val as Node, frame);
  ctx.emit(')');
  ctx.emit(')');
};

export const compileOptionalCall = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit('((');
  ctx.compileExpression(node.name as Node, frame);
  ctx.emit(') == null ? undefined : ');
  ctx.compileExpression(node.name as Node, frame);
  ctx.emit('(');
  compileAggregate(ctx, node.args as Node, frame, { startChar: '', endChar: ')' });
  ctx.emit(')');
};

export const compileSlice = (ctx: Compiler, node: Node, frame: Frame): void => {
  emitLocationGuard(ctx, locationFor(node));
  ctx.emit('runtime.slice((');
  if (node.start) {
    ctx.compileExpression(node.start as Node, frame);
  } else {
    ctx.emit('null');
  }
  ctx.emit('), (');
  if (node.stop) {
    ctx.compileExpression(node.stop as Node, frame);
  } else {
    ctx.emit('null');
  }
  ctx.emit('), (');
  if (node.step) {
    ctx.compileExpression(node.step as Node, frame);
  } else {
    ctx.emit('null');
  }
  ctx.emit('))');
  ctx.emit(')');
};
