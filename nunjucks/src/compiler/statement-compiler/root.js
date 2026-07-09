import { Block } from '../../nodes.js';
import { Frame } from '../../runtime/index.js';

export const compileRoot = (ctx, node, frame) => {
  if (frame) {
    ctx.fail('compileRoot: root node can\'t have frame');
  }

  frame = new Frame();

  ctx._emitFuncBegin(node, 'root');
  ctx._emitLine('var parentTemplate = null;');
  const childBuffer = 'childOutput';
  ctx._emitLine(`var ${childBuffer} = "";`);
  const savedBuffer = ctx.buffer;
  ctx.buffer = childBuffer;
  ctx._compileChildren(node, frame);
  ctx.buffer = savedBuffer;
  ctx._emitLine('if(parentTemplate) {');
  ctx._emitLine(`return await parentTemplate.rootRenderFunc(env, context, frame, runtime);`);
  ctx._emitLine('}');
  ctx._emitLine(`return ${childBuffer};`);
  ctx._emitFuncEnd(true);

  ctx.inBlock = true;

  const blockNames = [];

  const blocks = node.findAll(Block);

  blocks.forEach((block) => {
    const name = block.name.value;

    if (blockNames.indexOf(name) !== -1) {
      throw new Error(`Block "${name}" defined more than once.`);
    }
    blockNames.push(name);

    ctx._emitFuncBegin(block, `b_${name}`);

    const tmpFrame = new Frame();
    ctx._emitLine('var frame = frame.push(true);');
    ctx.compile(block.body, tmpFrame);
    ctx._emitFuncEnd();
  });

  ctx._emitLine('return {');

  blocks.forEach((block) => {
    const blockName = `b_${block.name.value}`;
    ctx._emitLine(`${blockName}: ${blockName},`);
  });

  ctx._emitLine('root: root\n};');
};
