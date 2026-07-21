import { createFrame } from '@nunjucks/runtime';
import type { Frame } from '@nunjucks/runtime';
import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import type { Compiler } from '../index.ts';

type NodeWithFindAll = Node & { findAll(type: string): Node[] };

export const compileRoot = (ctx: Compiler, node: Node, frame: Frame): void => {
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

  const blocks = (node as NodeWithFindAll).findAll('block');

  const blockLocation = (block: Node): { lineno: number; colno: number } => {
    const nameNode = block.name as Node | undefined;
    return {
      lineno: nameNode?.lineno ?? block.lineno ?? 0,
      colno: nameNode?.colno ?? block.colno ?? 0
    };
  };

  const nonBlockChildren = node.children!.filter(child => !nodes.isBlock(child));
  nonBlockChildren.forEach(child => {
    ctx.compile(child, frame);
  });

  ctx.buffer = savedBuffer;

  ctx._emitLine('if(parentTemplate) {');
  ctx._emitLine('  return await parentTemplate.rootRenderFunc(env, context, frame, runtime);');
  ctx._emitLine('} else {');
  blocks.forEach((block) => {
    const nameNode = block.name as Node | undefined;
    const name = nameNode?.value as string | undefined;
    if (!name) return;

    const { lineno, colno } = blockLocation(block);
    ctx._emitLine(`  lineno = ${lineno}; colno = ${colno};`);
    ctx._emitLine(`  ${childBuffer} += await context.getBlock("${name}", ${lineno}, ${colno})(env, context, frame, runtime);`);
  });
  ctx._emitLine('}');
  ctx._emitLine(`return ${childBuffer};`);
  ctx._emitFuncEnd(true);

  ctx.inBlock = true;

  const seenBlocks: string[] = [];

  blocks.forEach((block) => {
    const nameNode = block.name as Node | undefined;
    const name = nameNode?.value as string | undefined;
    const lineno = block.lineno;

    if (!name) return;

    if (seenBlocks.includes(name)) {
      throw createLog('error', ERROR_DEFINITIONS.DUPLICATE_BLOCK!, { name }, name, { lineno, colno: (nameNode?.colno as number) || 0, phase: 'compile' });
    }
    seenBlocks.push(name);

    ctx._emitFuncBegin(block, `b_${name}`);

    const tmpFrame = createFrame();
    ctx._emitLine('frame = frame.push(true);');
    ctx.compile(block.body as Node, tmpFrame);
    ctx._emitFuncEnd();
  });

  ctx._emitLine('return {');

  blocks.forEach((block) => {
    const nameNode = block.name as Node;
    const blockName = `b_${nameNode.value as string}`;
    ctx._emitLine(`${blockName}: ${blockName},`);
  });
  ctx._emitLine('__blockMeta: {');
  blocks.forEach((block) => {
    const nameNode = block.name as Node;
    const name = nameNode.value as string;
    const { lineno, colno } = blockLocation(block);
    ctx._emitLine(`${JSON.stringify(name)}: { lineno: ${lineno}, colno: ${colno} },`);
  });
  ctx._emitLine('},');

  ctx._emitLine('root: root\n};');
};
