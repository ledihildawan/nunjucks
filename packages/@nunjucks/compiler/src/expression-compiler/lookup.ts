import { isLiteral, isLookupVal, isSlice, isSymbol } from '@nunjucks/nodes';
import type { Node, LookupNode, SliceNode, CallNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';
import { compileAggregate } from './container.ts';

const locationFor = (node: Node | undefined, fallback: Node): { lineno: number; colno: number } => ({
  lineno: node?.lineno ?? fallback.lineno,
  colno: node?.colno ?? fallback.colno
});

const getTargetName = (node: Node | undefined): string | null => {
  if (!node) { return null; }
  if (isSymbol(node)) { return node.value; }
  if (isLookupVal(node)) {
    const parentName = getTargetName(node.target);
    const value = node.val;
    const propName: unknown = isLiteral(value) ? value.value : null;
    if (parentName && propName) { return `${parentName}.${propName}`; }
  }
  return null;
};

const emitSlice = (compiler: Compiler, value: SliceNode, node: LookupNode, frame: Frame): void => {
  compiler.emit('runtime.slice((');
  compiler.compileExpression(node.target, frame);
  compiler.emit('), ');
  if (value.start) { compiler.compileExpression(value.start, frame); } else { compiler.emit('null'); }
  compiler.emit(', ');
  if (value.stop) { compiler.compileExpression(value.stop, frame); } else { compiler.emit('null'); }
  compiler.emit(', ');
  if (value.step) { compiler.compileExpression(value.step, frame); } else { compiler.emit('null'); }
  compiler.emit(')');
};

const emitMemberLookup = (compiler: Compiler, node: LookupNode, value: Node, frame: Frame): void => {
  const parentName = getTargetName(node.target);
  compiler.emit('runtime.memberLookup((');
  compiler.compileExpression(node.target, frame);
  compiler.emit('),');
  compiler.compileExpression(value, frame);
  if (parentName === null) {
    compiler.emit(', null');
  } else {
    compiler.emit(`, ${JSON.stringify(parentName)}`);
  }
  compiler.emit(')');
};

export const compileLookupVal = (compiler: Compiler, node: LookupNode, frame: Frame): void => {
  const value = node.val;
  const location = locationFor(value, node);
  emitLocationGuard(compiler, location.lineno, location.colno);

  if (isSlice(value)) {
    emitSlice(compiler, value, node, frame);
  } else {
    emitMemberLookup(compiler, node, value, frame);
  }

  compiler.emit(')');
};

export const compileOptionalChain = (compiler: Compiler, node: LookupNode, frame: Frame): void => {
  const loc = locationFor(node.val, node);
  emitLocationGuard(compiler, loc.lineno, loc.colno);
  compiler.emit('runtime.optionalMemberLookup((');
  compiler.compileExpression(node.target, frame);
  compiler.emit('),');
  compiler.compileExpression(node.val, frame);
  compiler.emit(')');
  compiler.emit(')');
};

export const compileOptionalCall = (compiler: Compiler, node: CallNode, frame: Frame): void => {
  compiler.emit('((');
  compiler.compileExpression(node.name, frame);
  compiler.emit(') == null ? undefined : ');
  compiler.compileExpression(node.name, frame);
  compiler.emit('(');
  compileAggregate(compiler, node, frame, { startChar: '', endChar: ')' });
  compiler.emit(')');
};

export const compileSlice = (compiler: Compiler, node: SliceNode, frame: Frame): void => {
  const loc = locationFor(node, node);
  emitLocationGuard(compiler, loc.lineno, loc.colno);
  compiler.emit('runtime.slice((');
  if (node.start) { compiler.compileExpression(node.start, frame); } else { compiler.emit('null'); }
  compiler.emit('), (');
  if (node.stop) { compiler.compileExpression(node.stop, frame); } else { compiler.emit('null'); }
  compiler.emit('), (');
  if (node.step) { compiler.compileExpression(node.step, frame); } else { compiler.emit('null'); }
  compiler.emit('))');
  compiler.emit(')');
};
