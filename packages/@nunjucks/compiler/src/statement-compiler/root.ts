import { createFrame } from '@nunjucks/runtime';
import type { Frame } from '@nunjucks/runtime';
import { findAll, isBlock } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import type { Compiler } from '../index.ts';

const getBlockLocation = (block: Node): { lineno: number; colno: number } => {
  const nameNode = block.name as Node | undefined;
  return {
    lineno: nameNode?.lineno ?? block.lineno ?? 0,
    colno: nameNode?.colno ?? block.colno ?? 0
  };
};

const setupRootFunction = (ctx: Compiler, node: Node): { frame: Frame; childBuffer: string; savedBuffer: string } => {
  const frame = createFrame();
  ctx.emitFuncBegin(node, 'root');
  ctx.emitLine('let parentTemplate = null;');
  const childBuffer = 'childOutput';
  ctx.emitLine(`let ${childBuffer} = "";`);
  const savedBuffer = ctx.buffer;
  ctx.buffer = childBuffer;
  return { frame, childBuffer, savedBuffer };
};

const compileNonBlockChildren = (ctx: Compiler, node: Node, frame: Frame): void => {
  const nonBlockChildren = node.children?.filter(child => !isBlock(child));
  for (const child of nonBlockChildren ?? []) {
    ctx.compile(child, frame);
  }
};

const emitParentTemplateBlockHandling = (
  ctx: Compiler,
  blocks: Node[],
  childBuffer: string
): void => {
  ctx.emitLine('if(parentTemplate) {');
  ctx.emitLine('  return await parentTemplate.rootRenderFunc(env, context, frame, runtime);');
  ctx.emitLine('} else {');
  for (const block of blocks) {
    const nameNode = block.name as Node | undefined;
    const name = nameNode?.value as string | undefined;
    if (!name) { continue; }
    const { lineno, colno } = getBlockLocation(block);
    ctx.emitLine(`  lineno = ${lineno}; colno = ${colno};`);
    ctx.emitLine(`  ${childBuffer} += await context.getBlock("${name}", ${lineno}, ${colno})(env, context, frame, runtime);`);
  }
  ctx.emitLine('}');
  ctx.emitLine(`return ${childBuffer};`);
  ctx.emitFuncEnd(true);
};

const validateUniqueBlockNames = (blocks: Node[]): void => {
  const seenBlocks: string[] = [];
  for (const block of blocks) {
    const nameNode = block.name as Node | undefined;
    const name = nameNode?.value as string | undefined;
    const { lineno } = block;
    if (!name) { continue; }
    if (seenBlocks.includes(name)) {
      const errorDef = ERROR_DEFINITIONS.DUPLICATE_BLOCK;
      if (errorDef) {
        throw createLog('error', errorDef, { name }, name, { lineno, colno: (nameNode?.colno as number) || 0, phase: 'compile' });
      }
      throw new Error(`Duplicate block: ${name}`);
    }
    seenBlocks.push(name);
  }
};

const emitBlockFunctions = (ctx: Compiler, blocks: Node[]): void => {
  for (const block of blocks) {
    const nameNode = block.name as Node | undefined;
    const name = nameNode?.value as string | undefined;
    if (!name) { continue; }
    ctx.emitFuncBegin(block, `b_${name}`);
    const tmpFrame = createFrame();
    ctx.emitLine('frame = frame.push(true);');
    ctx.compile(block.body as Node, tmpFrame);
    ctx.emitFuncEnd();
  }
};

const emitBlockReturnObject = (ctx: Compiler, blocks: Node[]): void => {
  ctx.emitLine('return {');
  for (const block of blocks) {
    const nameNode = block.name as Node;
    const blockName = `b_${nameNode.value as string}`;
    ctx.emitLine(`${blockName}: ${blockName},`);
  }
  ctx.emitLine('__blockMeta: {');
  for (const block of blocks) {
    const nameNode = block.name as Node;
    const name = nameNode.value as string;
    const { lineno, colno } = getBlockLocation(block);
    ctx.emitLine(`${JSON.stringify(name)}: { lineno: ${lineno}, colno: ${colno} },`);
  }
  ctx.emitLine('},');
  ctx.emitLine('root: root\n};');
};

export const compileRoot = (ctx: Compiler, node: Node, incomingFrame: Frame): void => {
  if (incomingFrame) {
    ctx.fail('compileRoot: root node can\'t have frame');
  }

  const blocks = findAll(node, 'block');
  const { frame, childBuffer, savedBuffer } = setupRootFunction(ctx, node);

  compileNonBlockChildren(ctx, node, frame);

  ctx.buffer = savedBuffer;

  emitParentTemplateBlockHandling(ctx, blocks, childBuffer);

  ctx.inBlock = true;

  validateUniqueBlockNames(blocks);
  emitBlockFunctions(ctx, blocks);
  emitBlockReturnObject(ctx, blocks);
};
