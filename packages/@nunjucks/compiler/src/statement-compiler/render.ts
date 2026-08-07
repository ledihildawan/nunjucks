import type { RenderNode } from '@nunjucks/nodes';
import { isFunCall } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';
import { compileSlotFunction } from './slot.ts';

export const compileRenderBlock = (compiler: Compiler, node: RenderNode, parentFrame: Frame): void => {
  const frame = parentFrame.push(true);
  compiler.emitLine('frame = frame.push(true);');

  const slots = node.providedSlots ?? [];
  const slotEntries: string[] = [];
  for (const slot of slots) {
    const slotVar = `__slot_${slot.name}`;
    compileSlotFunction(compiler, slot.params, slot.body, frame, slotVar);
    slotEntries.push(`"${slot.name}": ${slotVar}`);
  }

  const callExpr = node.callExpr;

  compiler.emit(`lineno = ${node.lineno}; colno = ${node.colno ?? 0}; ${compiler.buffer} += runtime.suppressValue(`);
  compiler.emit('await runtime.awaitValue(');

  if (isFunCall(callExpr)) {
    emitLocationGuard(compiler, node.lineno, node.colno ?? 0);
    compiler.emit('runtime.callWrap(');
    compiler.compile(callExpr.name, frame);
    const fnName = callExpr.name;
    const nameStr = fnName.type === 'symbol' ? String(fnName.value) : 'render';
    compiler.emit(`, ${JSON.stringify(nameStr)}, null, context, [`);
    const args = callExpr.args;
    args.forEach((argument, i) => {
      if (i > 0) { compiler.emit(', '); }
      if (argument) { compiler.compile(argument, frame); }
    });
    if (args.length > 0) { compiler.emit(', '); }

    const kwargsParts: string[] = [];
    if (slotEntries.length > 0) {
      kwargsParts.push(`slots: { ${slotEntries.join(', ')} }`);
    }
    compiler.emit(`runtime.makeKeywordArgs({ ${kwargsParts.join(', ')} })`);
    compiler.emit(']))');
  } else {
    compiler.compile(callExpr, frame);
  }

  compiler.emitLine(`), env.opts.autoescape, lineno, colno, "html");`);

  compiler.emitLine('frame = frame.pop();');
};
