import type { RenderNode } from '@nunjucks/nodes';
import { isFunCall } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';
import { compileSlotFunction } from './slot.ts';

export const compileRenderBlock = (ctx: Compiler, node: RenderNode, parentFrame: Frame): void => {
  const frame = parentFrame.push(true);
  ctx.emitLine('frame = frame.push(true);');

  const slots = node.providedSlots ?? [];
  const slotEntries: string[] = [];
  forEach(slots, slot => {
    const slotVar = `__slot_${slot.name}`;
    compileSlotFunction(ctx, slot.params, slot.body, frame, slotVar);
    slotEntries.push(`"${slot.name}": ${slotVar}`);
  });

  const callExpr = node.callExpr;

  ctx.emit(`lineno = ${node.lineno}; colno = ${node.colno ?? 0}; ${ctx.buffer} += runtime.suppressValue(`);
  ctx.emit('await runtime.awaitValue(');

  if (isFunCall(callExpr)) {
    emitLocationGuard(ctx, node.lineno, node.colno ?? 0);
    ctx.emit('runtime.callWrap(');
    ctx.compile(callExpr.name, frame);
    const fnName = callExpr.name;
    const nameStr = fnName.type === 'symbol' ? String(fnName.value) : 'render';
    ctx.emit(`, ${JSON.stringify(nameStr)}, null, context, [`);
    const args = callExpr.args;
    args.forEach((arg, i) => {
      if (i > 0) { ctx.emit(', '); }
      if (arg) { ctx.compile(arg, frame); }
    });
    if (args.length > 0) { ctx.emit(', '); }

    const kwargsParts: string[] = [];
    if (slotEntries.length > 0) {
      kwargsParts.push(`slots: { ${slotEntries.join(', ')} }`);
    }
    ctx.emit(`runtime.makeKeywordArgs({ ${kwargsParts.join(', ')} })`);
    ctx.emit(']))');
  } else {
    ctx.compile(callExpr, frame);
  }

  ctx.emitLine(`), env.opts.autoescape, lineno, colno, "html");`);

  ctx.emitLine('frame = frame.pop();');
};
