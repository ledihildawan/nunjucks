import { forEach } from 'remeda';
import type { CallNode, RenderNode, SlotBlock } from '@nunjucks/nodes';
import { isFunCall } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { emitLocationGuard, appendTarget, assertSafeIdentifier } from '../codegen.ts';
import { compileSlotFunction } from './slot.ts';

const compileRenderSlots = (
  compiler: Compiler,
  slots: readonly SlotBlock[],
  frame: Frame
): string => {
  const entries: string[] = [];
  forEach(slots, (slot) => {
    assertSafeIdentifier(slot.name, { compiler });
    const slotVar = `__slot_${slot.name}`;
    compileSlotFunction({ compiler, params: slot.params, body: slot.body, parentFrame: frame, slotVar });
    entries.push(`${JSON.stringify(slot.name)}: ${slotVar}`);
  });
  return `slots: { ${entries.join(', ')} }`;
};

const compileRenderFunCall = (compiler: Compiler, callExpr: CallNode, frame: Frame, kwargsPart: string): void => {
  emitLocationGuard(compiler, callExpr.lineno, callExpr.colno ?? 0);
  compiler.emit('runtime.callWrap(');
  compiler.compile(callExpr.name, frame);
  const nameStr = callExpr.name.type === 'symbol' ? String(callExpr.name.value) : 'render';
  compiler.emit(`, ${JSON.stringify(nameStr)}, { displayName: null, context, args: [`);
  const args = callExpr.args;
  forEach(args, (argument: Node, i: number) => {
    if (i > 0) { compiler.emit(', '); }
    if (argument) { compiler.compile(argument, frame); }
  });
  if (args.length > 0) { compiler.emit(', '); }
  compiler.emit(`runtime.makeKeywordArgs({ ${kwargsPart} })`);
  compiler.emit('] }))');
};

export const compileRenderBlock = (compiler: Compiler, { node, frame: parentFrame }: CompileNodeInput<RenderNode>): void => {
  const frame = parentFrame.push(true);
  compiler.emitLine('frame = frame.push(true);');

  const slots = node.providedSlots ?? [];
  const kwargsPart = slots.length > 0 ? compileRenderSlots(compiler, slots, frame) : '';

  const callExpr = node.callExpr;

  const prefix = compiler.streamErrorRecovery
    ? `lineno = ${node.lineno}; colno = ${node.colno ?? 0}; try { ${appendTarget(compiler)}runtime.suppressValue(`
    : `lineno = ${node.lineno}; colno = ${node.colno ?? 0}; ${appendTarget(compiler)}runtime.suppressValue(`;
  compiler.emit(prefix);
  compiler.emit('await runtime.awaitValue(');

  if (isFunCall(callExpr)) {
    compileRenderFunCall(compiler, callExpr, frame, kwargsPart);
  } else {
    compiler.compile(callExpr, frame);
  }

  compiler.emitLine(`), { autoescape: env.opts.autoescape, lineno, colno, context: "html" });`);
  if (compiler.streamErrorRecovery) {
    compiler.emitStreamCatch(node.lineno ?? 0, node.colno ?? 0);
  }
  compiler.emitLine('frame = frame.pop();');
};
