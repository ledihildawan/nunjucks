import type { CallNode, Node, RenderNode, SlotBlock } from '@nunjucks/nodes';
import { isFunCall } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import { appendTarget, assertSafeIdentifier, emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileSlotFunction } from './slot.ts';

const compileRenderSlots = (
  compiler: Compiler,
  slots: readonly SlotBlock[],
  frame: Frame
): string => {
  const entries: string[] = [];
  const seenSlotNames = new Set<string>();
  forEach(slots, (slot) => {
    assertSafeIdentifier(slot.name, { compiler });
    // WHY: duplicate names in one render collapsed to object-literal last-wins — the
    // first slot body silently vanished. Fail at compile time with a catalogued error.
    if (seenSlotNames.has(slot.name)) {
      compiler.fail({
        message: `Duplicate slot name "${slot.name}" in render block`,
        errorName: 'DUPLICATE_SLOT',
      });
    }
    seenSlotNames.add(slot.name);
    // WHY: gensym'd slot var — two {% render %} blocks providing the same slot name
    // must not collide on a shared `let __slot_<name>` declaration at generator scope
    // (duplicate-let is a SyntaxError that killed the whole compiled template).
    const slotVar = `__slot_${slot.name}_${compiler.nextCompilerId()}`;
    compileSlotFunction({
      compiler,
      params: slot.params,
      body: slot.body,
      parentFrame: frame,
      slotVar,
    });
    entries.push(`${JSON.stringify(slot.name)}: ${slotVar}`);
  });
  return `slots: { ${entries.join(', ')} }`;
};

interface CompileRenderFunCallInput {
  compiler: Compiler;
  callExpr: CallNode;
  frame: Frame;
  kwargsPart: string;
}

const compileRenderFunCall = ({
  compiler,
  callExpr,
  frame,
  kwargsPart,
}: CompileRenderFunCallInput): void => {
  emitLocationGuard(compiler, callExpr.lineno, callExpr.colno ?? 0);
  compiler.emit('runtime.callWrap(');
  compiler.compile(callExpr.name, frame);
  const nameStr = callExpr.name.type === 'symbol' ? String(callExpr.name.value) : 'render';
  compiler.emit(`, ${JSON.stringify(nameStr)}, { displayName: null, context, args: [`);
  const args = callExpr.args;
  forEach(args, (argument: Node, i: number) => {
    if (i > 0) {
      compiler.emit(', ');
    }
    if (argument) {
      compiler.compile(argument, frame);
    }
  });
  if (args.length > 0) {
    compiler.emit(', ');
  }
  compiler.emit(`runtime.makeKeywordArgs({ ${kwargsPart} })`);
  compiler.emit('] }))');
};

/**
 * Compiles `{% render %}` in a pushed frame: provided slots become
 * gensym'd async functions, the call expression runs through
 * `runtime.callWrap` (or plain compilation), and the result is awaited and
 * emitted through `runtime.suppressValue`.
 */
export const compileRenderBlock = (
  compiler: Compiler,
  { node, frame: parentFrame }: CompileNodeInput<RenderNode>
): void => {
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
    compileRenderFunCall({ compiler, callExpr, frame, kwargsPart });
  } else {
    compiler.compile(callExpr, frame);
  }

  compiler.emitLine(`), { autoescape: env.opts.autoescape, lineno, colno, context: "html" });`);
  if (compiler.streamErrorRecovery) {
    compiler.emitStreamCatch(node.lineno ?? 0, node.colno ?? 0);
  }
  compiler.emitLine('frame = frame.pop();');
};
