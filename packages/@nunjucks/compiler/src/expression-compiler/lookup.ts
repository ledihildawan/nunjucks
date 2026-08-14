import { isLiteral, isLookupVal, isSlice, isSymbol } from '@nunjucks/nodes';
import type { Node, LookupNode, SliceNode, CallNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
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

interface EmitSliceOptions {
  compiler: Compiler;
  value: SliceNode;
  node: LookupNode;
  frame: Frame;
}

const emitSlice = ({ compiler, value, node, frame }: EmitSliceOptions): void => {
  compiler.emit('runtime.slice({ source: (');
  compiler.compileExpression(node.target, frame);
  compiler.emit('), start: ');
  if (value.start) { compiler.compileExpression(value.start, frame); } else { compiler.emit('null'); }
  compiler.emit(', stop: ');
  if (value.stop) { compiler.compileExpression(value.stop, frame); } else { compiler.emit('null'); }
  compiler.emit(', step: ');
  if (value.step) { compiler.compileExpression(value.step, frame); } else { compiler.emit('null'); }
  compiler.emit(' })');
};

interface EmitMemberLookupOptions {
  compiler: Compiler;
  node: LookupNode;
  value: Node;
  frame: Frame;
}

const emitMemberLookup = ({ compiler, node, value, frame }: EmitMemberLookupOptions): void => {
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

export const compileLookupVal = (compiler: Compiler, { node, frame }: CompileNodeInput<LookupNode>): void => {
  const value = node.val;
  const location = locationFor(value, node);
  emitLocationGuard(compiler, location.lineno, location.colno);

  if (isSlice(value)) {
    emitSlice({ compiler, value, node, frame });
  } else {
    emitMemberLookup({ compiler, node, value, frame });
  }

  compiler.emit(')');
};

export const compileOptionalChain = (compiler: Compiler, { node, frame }: CompileNodeInput<LookupNode>): void => {
  const nodeLoc = locationFor(node.val, node);
  emitLocationGuard(compiler, nodeLoc.lineno, nodeLoc.colno);
  compiler.emit('runtime.optionalMemberLookup((');
  compiler.compileExpression(node.target, frame);
  compiler.emit('),');
  compiler.compileExpression(node.val, frame);
  compiler.emit(')');
  compiler.emit(')');
};

export const compileOptionalCall = (compiler: Compiler, { node, frame }: CompileNodeInput<CallNode>): void => {
  compiler.emit('((');
  compiler.compileExpression(node.name, frame);
  compiler.emit(') == null ? undefined : ');
  compiler.compileExpression(node.name, frame);
  compiler.emit('(');
  compileAggregate(compiler, node, frame, { startChar: '', endChar: ')' });
  compiler.emit(')');
};

export const compileSlice = (compiler: Compiler, { node, frame }: CompileNodeInput<SliceNode>): void => {
  const nodeLoc = locationFor(node, node);
  emitLocationGuard(compiler, nodeLoc.lineno, nodeLoc.colno);
  compiler.emit('runtime.slice({ source: (');
  if (node.start) { compiler.compileExpression(node.start, frame); } else { compiler.emit('null'); }
  compiler.emit('), start: ');
  if (node.stop) { compiler.compileExpression(node.stop, frame); } else { compiler.emit('null'); }
  compiler.emit(', stop: ');
  if (node.step) { compiler.compileExpression(node.step, frame); } else { compiler.emit('null'); }
  compiler.emit(', step: null })');
};
