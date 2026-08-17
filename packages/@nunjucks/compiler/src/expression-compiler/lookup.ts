import type { CallNode, LookupNode, Node, SliceNode } from '@nunjucks/nodes';
import { isLiteral, isLookupVal, isSlice, isSymbol } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileAggregate } from './container.ts';

// WHY: a standalone SliceNode has no source operand — the parser only ever produces
// slices as a LookupNode's `val`, where compileLookupVal/emitSlice wires the target
// in. There is deliberately NO dispatch entry for T.SLICE: a hand-built standalone
// slice fails closed through the dispatch's unknown-type path instead of silently
// compiling rotated operands.

const locationFor = (
  node: Node | undefined,
  fallback: Node
): { lineno: number; colno: number } => ({
  lineno: node?.lineno ?? fallback.lineno,
  colno: node?.colno ?? fallback.colno,
});

const getTargetName = (node: Node | undefined): string | null => {
  if (!node) {
    return null;
  }
  if (isSymbol(node)) {
    return node.value;
  }
  if (isLookupVal(node)) {
    const parentName = getTargetName(node.target);
    const value = node.val;
    const propName: unknown = isLiteral(value) ? value.value : null;
    if (parentName && propName) {
      return `${parentName}.${propName}`;
    }
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
  if (value.start) {
    compiler.compileExpression(value.start, frame);
  } else {
    compiler.emit('null');
  }
  compiler.emit(', stop: ');
  if (value.stop) {
    compiler.compileExpression(value.stop, frame);
  } else {
    compiler.emit('null');
  }
  compiler.emit(', step: ');
  if (value.step) {
    compiler.compileExpression(value.step, frame);
  } else {
    compiler.emit('null');
  }
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

/**
 * Compiles `a[b]` — slices route to `runtime.slice({ source, start, stop,
 * step })`, members to `runtime.memberLookup` (with the dotted target name
 * for diagnostics); the location guard tracks the property position.
 */
export const compileLookupVal = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<LookupNode>
): void => {
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

/** Compiles `a?.[b]` to `runtime.optionalMemberLookup(target, val)`. */
export const compileOptionalChain = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<LookupNode>
): void => {
  const nodeLoc = locationFor(node.val, node);
  emitLocationGuard(compiler, nodeLoc.lineno, nodeLoc.colno);
  compiler.emit('runtime.optionalMemberLookup((');
  compiler.compileExpression(node.target, frame);
  compiler.emit('),');
  compiler.compileExpression(node.val, frame);
  compiler.emit(')');
  compiler.emit(')');
};

/** Compiles `fn?.(...)` to a null-short-circuit around the plain call. */
export const compileOptionalCall = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CallNode>
): void => {
  compiler.emit('((');
  compiler.compileExpression(node.name, frame);
  compiler.emit(') == null ? undefined : ');
  compiler.compileExpression(node.name, frame);
  compiler.emit('(');
  compileAggregate(compiler, { node, frame, options: { startChar: '', endChar: ')' } });
  compiler.emit(')');
};
