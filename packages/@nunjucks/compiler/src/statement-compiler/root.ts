import { forEach } from 'remeda';
import { createFrame } from '@nunjucks/runtime';
import type { Frame } from '@nunjucks/runtime';
import { findAll, isBlock } from '@nunjucks/nodes';
import type { Node, ChildrenNode, BlockNode, NodeLocation } from '@nunjucks/nodes';
import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
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

const setupRootFunction = (compiler: Compiler, node: Node): { frame: Frame } => {
  const frame = createFrame();
  compiler.emitFuncBegin(node, 'root');
  compiler.emitLine('let parentTemplate = null;');
  // WHY: root is an async generator (emitFuncBegin set buffer=null), so non-block children yield directly instead of accumulating into a childOutput buffer.
  return { frame };
};

const compileNonBlockChildren = (compiler: Compiler, node: Node, frame: Frame): void => {
  const nonBlockChildren = node.children?.filter(child => !isBlock(child)) ?? [];
  forEach(nonBlockChildren, (child) => { compiler.compile(child, frame); });
};

const emitParentTemplateBlockHandling = (
  compiler: Compiler,
  blocks: BlockNode[]
): void => {
  compiler.emitLine('if(parentTemplate) {');
  // WHY: parentTemplate.rootRenderFunc is itself an async generator — delegate so its chunks stream straight through, and propagate its returned context as this root's return value.
  compiler.emitLine('  return yield* parentTemplate.rootRenderFunc(env, context, frame, runtime);');
  compiler.emitLine('}');
  forEach(blocks, (block) => {
    const name = blockName(block);
    if (!name) { return; }
    const { lineno, colno } = getBlockLocation(block);
    compiler.emitLine(`lineno = ${lineno}; colno = ${colno};`);
    // WHY: Option C — blocks are async generators; delegate so their chunks stream directly into the root output.
    compiler.emitLine(`yield* (await context.getBlock("${name}", ${lineno}, ${colno}))(env, context, frame, runtime);`);
  });
  compiler.emitLine('return context;');
  compiler.emitFuncEnd(true);
};

const validateUniqueBlockNames = (blocks: BlockNode[]): void => {
  const seenBlocks = new Set<string>();
  forEach(blocks, (block) => {
    const name = blockName(block);
    const { lineno, colno } = block;
    if (!name) { return; }
    if (seenBlocks.has(name)) {
      throw createLog('error', { def: ERROR_DEFINITIONS.DUPLICATE_BLOCK, params: { name }, subject: name, context: { lineno, colno: colno ?? 0, phase: 'compile' } });
    }
    seenBlocks.add(name);
  });
};

const emitBlockFunctions = (compiler: Compiler, blocks: BlockNode[]): void => {
  forEach(blocks, (block) => {
    const name = blockName(block);
    if (!name) { return; }
    compiler.emitFuncBegin(block, `b_${name}`);
    const tmpFrame = createFrame();
    compiler.emitLine('frame = frame.push(true);');
    compiler.compile(block.body, tmpFrame);
    compiler.emitFuncEnd();
  });
};

const emitBlockReturnObject = (compiler: Compiler, blocks: BlockNode[]): void => {
  compiler.emitLine('return {');
  forEach(blocks, (block) => {
    const name = blockName(block);
    if (name === undefined) { return; }
    const blockNameId = `b_${name}`;
    compiler.emitLine(`${blockNameId}: ${blockNameId},`);
  });
  compiler.emitLine(`${BLOCK_META_KEY}: {`);
  forEach(blocks, (block) => {
    const name = blockName(block);
    if (name === undefined) { return; }
    const { lineno, colno } = getBlockLocation(block);
    compiler.emitLine(`${JSON.stringify(name)}: { lineno: ${lineno}, colno: ${colno} },`);
  });
  compiler.emitLine('},');
  compiler.emitLine('root: root\n};');
};

export const compileRoot = (compiler: Compiler, node: ChildrenNode): void => {
  const blocks = findAll(node, 'block').filter(isBlock);
  const { frame } = setupRootFunction(compiler, node);

  compileNonBlockChildren(compiler, node, frame);

  emitParentTemplateBlockHandling(compiler, blocks);

  compiler.inBlock = true;

  validateUniqueBlockNames(blocks);
  emitBlockFunctions(compiler, blocks);
  emitBlockReturnObject(compiler, blocks);
};
