import { createFrame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import type { Frame } from '@nunjucks/runtime';
import type { Node } from '@nunjucks/nodes';

interface SlotFunctionInput {
  compiler: Compiler;
  params: readonly string[];
  body: Node;
  parentFrame: Frame;
  slotVar: string;
}

const compileSlotFunction = ({ compiler, params, body, parentFrame, slotVar }: SlotFunctionInput): void => {
  const localParams = params.map(p => `l_${p}`);

  compiler.emitLine(`let ${slotVar} = async (${localParams.join(', ')}) => {`);
  compiler.emitLine('  let __slotFrame = frame;');
  compiler.emitLine('  frame = runtime.createFrame(__slotFrame);');

  const slotFrame = createFrame({ parent: parentFrame });
  forEach(params, param => {
    compiler.emitLine(`  frame = frame.set("${param}", l_${param});`);
    slotFrame.set(param, `l_${param}`);
  });

  const buf = compiler.pushBuffer();
  compiler.withScopedSyntax(() => {
    compiler.compile(body, slotFrame);
  });
  compiler.emitLine('  frame = __slotFrame;');
  compiler.emitLine(`  return runtime.createSafeString(${buf});`);
  compiler.emitLine('}');
  compiler.popBuffer();
};

export { compileSlotFunction };
