import { createFrame } from '@nunjucks/runtime';
import type { Frame } from '@nunjucks/runtime';
import { findAll, isBlock } from '@nunjucks/nodes';
import type { Node, ChildrenNode, BlockNode, NodeLocation } from '@nunjucks/nodes';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import { BLOCK_META_KEY } from '@nunjucks/shared';
import type { Compiler } from '../index.ts';

const blockName = (block: BlockNode): string | undefined => {
  const { name } = block;
  if (typeof name === 'string') { return name; }
  return name?.value as string | undefined;
};

const getBlockLocation = (block: BlockNode): NodeLocation => ({
  lineno: block.lineno ?? 0,
  colno: block.colno ?? 0,
});

const setupRootFunction = (ctx: Compiler, node: Node): { frame: Frame; childBuffer: string; savedBuffer: string } => {
  const frame = createFrame();
  ctx.emitFuncBegin(node, 'root');
  ctx.emitLine('let parentTemplate = null;');
  const childBuffer = 'childOutput';
  ctx.emitLine(`let ${childBuffer} = "";`);
  const savedBuffer = ctx.buffer ?? '';
  ctx.buffer = childBuffer;
  return { frame, childBuffer, savedBuffer };
};

const compileNonBlockChildren = (ctx: Compiler, node: Node, frame: Frame): void => {
  const nonBlockChildren = node.children?.filter(child => !isBlock(child)) ?? [];
  for (const child of nonBlockChildren) { ctx.compile(child, frame); }
};

const emitParentTemplateBlockHandling = (
  ctx: Compiler,
  blocks: BlockNode[],
  childBuffer: string
): void => {
  ctx.emitLine('if(parentTemplate) {');
  ctx.emitLine('  return await parentTemplate.rootRenderFunc(env, context, frame, runtime);');
  ctx.emitLine('} else {');
  for (const block of blocks) {
    const name = blockName(block);
    if (!name) { continue; }
    const { lineno, colno } = getBlockLocation(block);
    ctx.emitLine(`  lineno = ${lineno}; colno = ${colno};`);
    ctx.emitLine(`  ${childBuffer} += await context.getBlock("${name}", ${lineno}, ${colno})(env, context, frame, runtime);`);
  }
  ctx.emitLine('}');
  ctx.emitLine(`return ${childBuffer};`);
  ctx.emitFuncEnd(true);
};

const validateUniqueBlockNames = (blocks: BlockNode[]): void => {
  const seenBlocks: string[] = [];
  for (const block of blocks) {
    const name = blockName(block);
    const { lineno } = block;
    if (!name) { continue; }
    if (seenBlocks.includes(name)) {
      throw createLog('error', ERROR_DEFINITIONS.DUPLICATE_BLOCK, { name }, name, { lineno, colno: (block.colno as number) || 0, phase: 'compile' });
    }
    seenBlocks.push(name);
  }
};

const emitBlockFunctions = (ctx: Compiler, blocks: BlockNode[]): void => {
  for (const block of blocks) {
    const name = blockName(block);
    if (!name) { continue; }
    ctx.emitFuncBegin(block, `b_${name}`);
    const tmpFrame = createFrame();
    ctx.emitLine('frame = frame.push(true);');
    ctx.compile(block.body, tmpFrame);
    ctx.emitFuncEnd();
  }
};

const emitBlockReturnObject = (ctx: Compiler, blocks: BlockNode[]): void => {
  ctx.emitLine('return {');
  for (const block of blocks) {
    const name = blockName(block);
    if (name === undefined) { continue; }
    const blockNameId = `b_${name}`;
    ctx.emitLine(`${blockNameId}: ${blockNameId},`);
  }
  ctx.emitLine(`${BLOCK_META_KEY}: {`);
  for (const block of blocks) {
    const name = blockName(block);
    if (name === undefined) { continue; }
    const { lineno, colno } = getBlockLocation(block);
    ctx.emitLine(`${JSON.stringify(name)}: { lineno: ${lineno}, colno: ${colno} },`);
  }
  ctx.emitLine('},');
  ctx.emitLine('root: root\n};');
};

export const compileRoot = (ctx: Compiler, node: ChildrenNode): void => {
  const blocks = findAll(node, 'block').filter(isBlock);
  const { frame, childBuffer, savedBuffer } = setupRootFunction(ctx, node);

  compileNonBlockChildren(ctx, node, frame);

  ctx.buffer = savedBuffer;

  emitParentTemplateBlockHandling(ctx, blocks, childBuffer);

  ctx.inBlock = true;

  validateUniqueBlockNames(blocks);
  emitBlockFunctions(ctx, blocks);
  emitBlockReturnObject(ctx, blocks);
};
