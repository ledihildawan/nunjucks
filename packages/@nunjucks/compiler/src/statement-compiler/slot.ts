// Shared slot-function compilation. A slot body becomes a SlotFn that renders
// into a fresh buffer. The slot frame inherits the invocation-time frame
// (parent chain), so slot bodies can see the enclosing scope: `slot`,
// `children`, and consumer variables.
import { createFrame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import type { Frame } from '@nunjucks/runtime';
import type { Node } from '@nunjucks/nodes';

const compileSlotFunction = (
  ctx: Compiler,
  params: string[],
  body: Node,
  parentFrame: Frame,
  slotVar: string,
): void => {
  const localParams = params.map(p => `l_${p}`);

  // A SlotFn is a plain positional function — `slot(name, ...args)` calls it
  // with the scoped values directly. No makeComponent kwargs juggling here.
  ctx.emitLine(`let ${slotVar} = async (${localParams.join(', ')}) => {`);
  ctx.emitLine('  let __slotFrame = frame;');
  ctx.emitLine('  frame = runtime.createFrame(__slotFrame);');

  const slotFrame = createFrame(parentFrame);
  forEach(params, param => {
    ctx.emitLine(`  frame.set("${param}", l_${param});`);
    slotFrame.set(param, `l_${param}`);
  });

  const buf = ctx.pushBuffer();
  ctx.withScopedSyntax(() => {
    ctx.compile(body, slotFrame);
  });
  ctx.emitLine('  frame = __slotFrame;');
  ctx.emitLine(`  return runtime.createSafeString(${buf});`);
  ctx.emitLine('}');
  ctx.popBuffer();
};

export { compileSlotFunction };
