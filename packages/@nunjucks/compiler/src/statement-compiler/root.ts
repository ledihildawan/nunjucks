import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import type { BlockNode, ChildrenNode, Node, NodeLocation } from '@nunjucks/nodes';
import { findAll, isBlock } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createFrame } from '@nunjucks/runtime';
import { BLOCK_META_KEY } from '@nunjucks/shared';
import { forEach } from 'remeda';
import { assertSafeIdentifier } from '../codegen.ts';
import type { Compiler } from '../index.ts';

const blockName = (block: BlockNode): string | undefined => {
  const { name } = block;
  if (typeof name === 'string') {
    return name;
  }
  return name ? String(name.value) : undefined;
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

// WHY: ALL direct children compile in document order — blocks are NOT hoisted out of
// the body. compileBlock renders each in place via context.getBlock (which resolves
// the extends-override chain), so `A{% block b %}B{% endblock %}C` renders "ABC" and
// nested blocks render exactly once. The previous filter-then-re-yield pass scrambled
// document order and double-rendered nested blocks.
const compileRootChildren = (compiler: Compiler, node: Node, frame: Frame): void => {
  forEach(node.children ?? [], (child) => {
    compiler.compile(child, frame);
  });
};

const emitParentTemplateDelegation = (compiler: Compiler): void => {
  compiler.emitLine('if(parentTemplate) {');
  // WHY: parentTemplate.rootRenderFunc is itself an async generator — delegate so its chunks stream straight through, and propagate its returned context as this root's return value.
  compiler.emitLine('  return yield* parentTemplate.rootRenderFunc(env, context, frame, runtime);');
  compiler.emitLine('}');
  compiler.emitLine('return context;');
  compiler.emitFuncEnd(true);
};

const validateUniqueBlockNames = (blocks: BlockNode[]): void => {
  const seenBlocks = new Set<string>();
  forEach(blocks, (block) => {
    const name = blockName(block);
    const { lineno, colno } = block;
    if (!name) {
      return;
    }
    if (seenBlocks.has(name)) {
      throw createLog('error', {
        def: ERROR_DEFINITIONS.DUPLICATE_BLOCK,
        params: { name },
        subject: name,
        context: { lineno, colno: colno ?? 0, phase: 'compile' },
      });
    }
    seenBlocks.add(name);
  });
};

const emitBlockFunctions = (compiler: Compiler, blocks: BlockNode[]): void => {
  forEach(blocks, (block) => {
    const name = blockName(block);
    if (!name) {
      return;
    }
    assertSafeIdentifier(name, { compiler, lineno: block.lineno, colno: block.colno });
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
    if (name === undefined) {
      return;
    }
    assertSafeIdentifier(name, { compiler, lineno: block.lineno, colno: block.colno });
    const blockNameId = `b_${name}`;
    compiler.emitLine(`${blockNameId}: ${blockNameId},`);
  });
  compiler.emitLine(`${BLOCK_META_KEY}: {`);
  forEach(blocks, (block) => {
    const name = blockName(block);
    if (name === undefined) {
      return;
    }
    const { lineno, colno } = getBlockLocation(block);
    compiler.emitLine(`${JSON.stringify(name)}: { lineno: ${lineno}, colno: ${colno} },`);
  });
  compiler.emitLine('},');
  compiler.emitLine('root: root\n};');
};

export const compileRoot = (compiler: Compiler, node: ChildrenNode): void => {
  const blocks = findAll(node, 'block').filter(isBlock);
  const { frame } = setupRootFunction(compiler, node);

  // WHY: Jinja parity — under extends the parent's delegation pass renders the page,
  // so the child's root-scope non-block output (stray text / {{ }}) would only prepend
  // noise. Blocks still compile (they ARE the override surface) and variable-like
  // children (walrus) keep running for their side effects.
  compiler.suppressRootOutput = findAll(node, 'extends').length > 0;

  compileRootChildren(compiler, node, frame);

  emitParentTemplateDelegation(compiler);

  compiler.inBlock = true;

  validateUniqueBlockNames(blocks);
  emitBlockFunctions(compiler, blocks);
  emitBlockReturnObject(compiler, blocks);
};
