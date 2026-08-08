import { forEach } from 'remeda';
import type { CallNode, RenderNode } from '@nunjucks/nodes';
import { isFunCall } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';
import { compileSlotFunction } from './slot.ts';

const compileRenderSlots = (
  compiler: Compiler,
  slots: readonly { name: string; params: string[]; body: Node }[],
  frame: Frame
): string => {
  const entries: string[] = [];
  forEach(slots, (slot) => {
    const slotVar = `__slot_${slot.name}`;
    compileSlotFunction({ compiler, params: slot.params, body: slot.body, parentFrame: frame, slotVar });
    entries.push(`"${slot.name}": ${slotVar}`);
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

export const compileRenderBlock = (compiler: Compiler, node: RenderNode, parentFrame: Frame): void => {
  const frame = parentFrame.push(true);
  compiler.emitLine('frame = frame.push(true);');

  const slots = node.providedSlots ?? [];
  const kwargsPart = slots.length > 0 ? compileRenderSlots(compiler, slots, frame) : '';

  const callExpr = node.callExpr;

  compiler.emit(`lineno = ${node.lineno}; colno = ${node.colno ?? 0}; ${compiler.buffer} += runtime.suppressValue(`);
  compiler.emit('await runtime.awaitValue(');

  if (isFunCall(callExpr)) {
    compileRenderFunCall(compiler, callExpr, frame, kwargsPart);
  } else {
    compiler.compile(callExpr, frame);
  }

  compiler.emitLine(`), { autoescape: env.opts.autoescape, lineno, colno, context: "html" });`);
  compiler.emitLine('frame = frame.pop();');
};
