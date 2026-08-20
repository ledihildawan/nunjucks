import type { CallNode, RenderNode, SlotBlock } from '@nunjucks/nodes';
import { isFunCall } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { appendTarget, assertSafeIdentifier, emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileSlotFunction } from './slot.ts';

const compileRenderSlots = (
  compiler: Compiler,
  slots: readonly SlotBlock[],
  frame: Frame
): string => {
  const entries: string[] = [];
  const seenSlotNames = new Set<string>();
  for (const slot of slots) {
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
  }
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
  emitLocationGuard(compiler, callExpr.lineno, callExpr.colno);
  compiler.emit('runtime.callWrap(');
  compiler.compile(callExpr.name, frame);
  const nameStr = callExpr.name.type === 'symbol' ? String(callExpr.name.value) : 'render';
  compiler.emit(`, ${JSON.stringify(nameStr)}, { displayName: null, context, args: [`);
  const args = callExpr.args;
  // WHY: imperative loop — comma placement between emitted fragments is
  // index-sensitive; a map().join() cannot interleave into the shared emit buffer.
  // Loop exemption: compiler emission path.
  let argumentIndex = 0;
  for (const argument of args) {
    if (argumentIndex > 0) {
      compiler.emit(', ');
    }
    if (argument) {
      compiler.compile(argument, frame);
    }
    argumentIndex += 1;
  }
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

  // WHY: render output must follow the tracked html context like every {{ }} emit —
  // a {% render %} sitting inside an attribute region attribute-escapes even SafeString
  // component markup (the runtime's attribute-injection defense); "html" here would
  // silently bypass it.
  const htmlContext = compiler.getHtmlContext(node.lineno, node.colno);
  const prefix = compiler.streamErrorRecovery
    ? `lineno = ${node.lineno}; colno = ${node.colno}; try { ${appendTarget(compiler)}runtime.suppressValue(`
    : `lineno = ${node.lineno}; colno = ${node.colno}; ${appendTarget(compiler)}runtime.suppressValue(`;
  compiler.emit(prefix);
  compiler.emit('await runtime.awaitValue(');

  if (isFunCall(callExpr)) {
    compileRenderFunCall({ compiler, callExpr, frame, kwargsPart });
  } else {
    compiler.compile(callExpr, frame);
  }

  compiler.emitLine(
    `), { autoescape: env.opts.autoescape, lineno, colno, context: ${JSON.stringify(htmlContext)} });`
  );
  if (compiler.streamErrorRecovery) {
    compiler.emitStreamCatch(node.lineno, node.colno);
  }
  compiler.emitLine('frame = frame.pop();');
};
