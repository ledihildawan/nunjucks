import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileAggregate } from './container.ts';

const locationFor = (node: Node | undefined, fallback: Node = node as Node): { lineno: number; colno: number } => ({
  lineno: node?.lineno ?? fallback?.lineno ?? 0,
  colno: node?.colno ?? fallback?.colno ?? 0
});

const emitLocationGuard = (ctx: Compiler, location: { lineno: number; colno: number }): void => {
  ctx._emit('(lineno = ' + location.lineno + ', colno = ' + location.colno + ', ');
};

const getTargetName = (node: Node | undefined): string | null => {
  if (!node) return null;
  if (nodes.isSymbol(node)) return node.value as string;
  if (nodes.isLookupVal(node)) {
    const parentName = getTargetName(node.target as Node);
    const val = node.val as Node;
    const propName = nodes.isLiteral(val) ? (val.value as unknown) : null;
    if (parentName && propName) return `${parentName}.${propName}`;
  }
  return null;
};

export const compileLookupVal = (ctx: Compiler, node: Node, frame: Frame): void => {
  const val = node.val as Node;
  const location = locationFor(val, node);
  emitLocationGuard(ctx, location);

  if (nodes.isSlice(val)) {
    ctx._emit('runtime.slice((');
    ctx._compileExpression(node.target as Node, frame);
    ctx._emit('), ');
    if (val.start) {
      ctx._compileExpression(val.start as Node, frame);
    } else {
      ctx._emit('null');
    }
    ctx._emit(', ');
    if (val.stop) {
      ctx._compileExpression(val.stop as Node, frame);
    } else {
      ctx._emit('null');
    }
    ctx._emit(', ');
    if (val.step) {
      ctx._compileExpression(val.step as Node, frame);
    } else {
      ctx._emit('null');
    }
    ctx._emit(')');
  } else {
    const parentName = getTargetName(node.target as Node);
    ctx._emit('runtime.memberLookup((');
    ctx._compileExpression(node.target as Node, frame);
    ctx._emit('),');
    ctx._compileExpression(val, frame);
    if (parentName !== null) {
      ctx._emit(`, ${JSON.stringify(parentName)}`);
    } else {
      ctx._emit(', null');
    }
    ctx._emit(')');
  }

  ctx._emit(')');
};

export const compileOptionalChain = (ctx: Compiler, node: Node, frame: Frame): void => {
  emitLocationGuard(ctx, locationFor(node.val as Node, node));
  ctx._emit('runtime.optionalMemberLookup((');
  ctx._compileExpression(node.target as Node, frame);
  ctx._emit('),');
  ctx._compileExpression(node.val as Node, frame);
  ctx._emit(')');
  ctx._emit(')');
};

export const compileOptionalCall = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx._emit('((');
  ctx._compileExpression(node.name as Node, frame);
  ctx._emit(') == null ? undefined : ');
  ctx._compileExpression(node.name as Node, frame);
  ctx._emit('(');
  compileAggregate(ctx, node.args as Node, frame, '', ')');
  ctx._emit(')');
};

export const compileSlice = (ctx: Compiler, node: Node, frame: Frame): void => {
  emitLocationGuard(ctx, locationFor(node));
  ctx._emit('runtime.slice((');
  if (node.start) {
    ctx._compileExpression(node.start as Node, frame);
  } else {
    ctx._emit('null');
  }
  ctx._emit('), (');
  if (node.stop) {
    ctx._compileExpression(node.stop as Node, frame);
  } else {
    ctx._emit('null');
  }
  ctx._emit('), (');
  if (node.step) {
    ctx._compileExpression(node.step as Node, frame);
  } else {
    ctx._emit('null');
  }
  ctx._emit('))');
  ctx._emit(')');
};
