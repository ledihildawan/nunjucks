import { createFrame } from '../../runtime/index.js';
import { nodes } from '../../nodes/index.js';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';
import { createLog } from '@nunjucks/log';

export const compileRoot = (ctx, node, frame) => {
  if (frame) {
    ctx.fail('compileRoot: root node can\'t have frame');
  }

  frame = createFrame();

  ctx._emitFuncBegin(node, 'root');
  ctx._emitLine('let parentTemplate = null;');
  const childBuffer = 'childOutput';
  ctx._emitLine(`let ${childBuffer} = "";`);
  const savedBuffer = ctx.buffer;
  ctx.buffer = childBuffer;

  const blocks = node.findAll('block');
  const blockNames = blocks.map(b => b.name?.value).filter(Boolean);
  const blockLocation = (block) => ({
    lineno: block.name?.lineno ?? block.lineno ?? 0,
    colno: block.name?.colno ?? block.colno ?? 0
  });

  const nonBlockChildren = node.children.filter(child => !nodes.isBlock(child));
  nonBlockChildren.forEach(child => {
    ctx.compile(child, frame);
  });

  ctx.buffer = savedBuffer;

  ctx._emitLine('if(parentTemplate) {');
  ctx._emitLine('  return await parentTemplate.rootRenderFunc(env, context, frame, runtime);');
  ctx._emitLine('} else {');
  blocks.forEach((block) => {
    const name = block.name?.value;
    if (!name) return;

    const { lineno, colno } = blockLocation(block);
    ctx._emitLine(`  lineno = ${lineno}; colno = ${colno};`);
    ctx._emitLine(`  ${childBuffer} += await context.getBlock("${name}")(env, context, frame, runtime);`);
  });
  ctx._emitLine('}');
  ctx._emitLine(`return ${childBuffer};`);
  ctx._emitFuncEnd(true);

  ctx.inBlock = true;

  const seenBlocks = [];

  blocks.forEach((block) => {
    const name = block.name?.value;
    const lineno = block.lineno;

    if (!name) return;

    if (seenBlocks.includes(name)) {
      throw createLog('error', ERROR_DEFINITIONS.DUPLICATE_BLOCK, { name }, name, { lineno, colno: block.name?.colno || 0, phase: 'compile' });
    }
    seenBlocks.push(name);

    ctx._emitFuncBegin(block, `b_${name}`);

    const tmpFrame = createFrame();
    ctx._emitLine('frame = frame.push(true);');
    ctx.compile(block.body, tmpFrame);
    ctx._emitFuncEnd();
  });

  ctx._emitLine('return {');

  blocks.forEach((block) => {
    const blockName = `b_${block.name.value}`;
    ctx._emitLine(`${blockName}: ${blockName},`);
  });
  ctx._emitLine('__blockMeta: {');
  blocks.forEach((block) => {
    const name = block.name.value;
    const { lineno, colno } = blockLocation(block);
    ctx._emitLine(`${JSON.stringify(name)}: { lineno: ${lineno}, colno: ${colno} },`);
  });
  ctx._emitLine('},');

  ctx._emitLine('root: root\n};');
};
