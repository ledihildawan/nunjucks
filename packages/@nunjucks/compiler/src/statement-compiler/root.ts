import { createFrame } from '@nunjucks/runtime';
import type { Frame } from '@nunjucks/runtime';
import { findAll, isBlock } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import type { Compiler } from '../index.ts';

export const compileRoot = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (frame) {
    ctx.fail('compileRoot: root node can\'t have frame');
  }

  frame = createFrame();

  ctx.emitFuncBegin(node, 'root');
  ctx.emitLine('let parentTemplate = null;');
  const childBuffer = 'childOutput';
  ctx.emitLine(`let ${childBuffer} = "";`);
  const savedBuffer = ctx.buffer;
  ctx.buffer = childBuffer;

  const blocks = findAll(node, 'block');

  const blockLocation = (block: Node): { lineno: number; colno: number } => {
    const nameNode = block.name as Node | undefined;
    return {
      lineno: nameNode?.lineno ?? block.lineno ?? 0,
      colno: nameNode?.colno ?? block.colno ?? 0
    };
  };

  const nonBlockChildren = node.children?.filter(child => !isBlock(child));
  nonBlockChildren.forEach(child => {
    ctx.compile(child, frame);
  });

  ctx.buffer = savedBuffer;

  ctx.emitLine('if(parentTemplate) {');
  ctx.emitLine('  return await parentTemplate.rootRenderFunc(env, context, frame, runtime);');
  ctx.emitLine('} else {');
  blocks.forEach((block) => {
    const nameNode = block.name as Node | undefined;
    const name = nameNode?.value as string | undefined;
    if (!name) { return; }

    const { lineno, colno } = blockLocation(block);
    ctx.emitLine(`  lineno = ${lineno}; colno = ${colno};`);
    ctx.emitLine(`  ${childBuffer} += await context.getBlock("${name}", ${lineno}, ${colno})(env, context, frame, runtime);`);
  });
  ctx.emitLine('}');
  ctx.emitLine(`return ${childBuffer};`);
  ctx.emitFuncEnd(true);

  ctx.inBlock = true;

  const seenBlocks: string[] = [];

  blocks.forEach((block) => {
    const nameNode = block.name as Node | undefined;
    const name = nameNode?.value as string | undefined;
    const lineno = block.lineno;

    if (!name) { return; }

    if (seenBlocks.includes(name)) {
      const errorDef = ERROR_DEFINITIONS.DUPLICATE_BLOCK;
      if (errorDef) {
        throw createLog('error', errorDef, { name }, name, { lineno, colno: (nameNode?.colno as number) || 0, phase: 'compile' });
      }
      throw new Error(`Duplicate block: ${name}`);
    }
    seenBlocks.push(name);

    ctx.emitFuncBegin(block, `b_${name}`);

    const tmpFrame = createFrame();
    ctx.emitLine('frame = frame.push(true);');
    ctx.compile(block.body as Node, tmpFrame);
    ctx.emitFuncEnd();
  });

  ctx.emitLine('return {');

  blocks.forEach((block) => {
    const nameNode = block.name as Node;
    const blockName = `b_${nameNode.value as string}`;
    ctx.emitLine(`${blockName}: ${blockName},`);
  });
  ctx.emitLine('__blockMeta: {');
  blocks.forEach((block) => {
    const nameNode = block.name as Node;
    const name = nameNode.value as string;
    const { lineno, colno } = blockLocation(block);
    ctx.emitLine(`${JSON.stringify(name)}: { lineno: ${lineno}, colno: ${colno} },`);
  });
  ctx.emitLine('},');

  ctx.emitLine('root: root\n};');
};
