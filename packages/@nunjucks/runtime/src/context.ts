import { ERROR_DEFINITIONS, createLog } from '@nunjucks/log';
import type { IncludeChain } from '@nunjucks/log';
import type { NodeLocation } from '@nunjucks/shared';
import { find, keys } from 'remeda';

const CONTEXT_KEY = Symbol('Context');

export interface Env {
  opts: {
    dev: boolean;
    autoescape: boolean;
    undefined: string;
  };
  getFilter: (name: string, lineno: number | null, colno: number | null) => unknown;
  getTest: (name: string, lineno: number | null, colno: number | null) => unknown;
  getTemplate?: (name: string, eagerCompile?: boolean, includeChain?: IncludeChain | null, ignoreMissing?: boolean) => unknown;
  emit?: (event: string, ...args: unknown[]) => void;
  _renderingTemplates?: Set<string | undefined>;
  emitter?: unknown;
}

type BlockLocation = NodeLocation;

export interface ContextMetadata {
  blockLocations?: Record<string, BlockLocation>;
}

type BlockFn = (...args: unknown[]) => unknown;
type GetSuperFn = (
  envObj: unknown,
  name: string,
  block: BlockFn,
  frame: unknown,
  runtime: unknown,
  lineno?: number | null,
  colno?: number | null,
) => unknown;

interface ReadOnlyContext {
  readonly env: Env;
  readonly ctx: Record<string, unknown>;
  readonly blocks: Record<string, unknown>;
  readonly metadata: ContextMetadata;
  readonly parentBlockNames: string[] | null;
  readonly validatedBlocks: boolean;
  readonly exported: string[];
  readonly lookup: (name: string) => unknown;
  readonly getBlock: (name: string, lineno?: number | null, colno?: number | null) => BlockFn;
  readonly getSuper: GetSuperFn;
  readonly getExported: () => Record<string, unknown>;
  readonly getVariables: () => Record<string, unknown>;
}

interface MutableContext extends ReadOnlyContext {
  env: Env;
  ctx: Record<string, unknown>;
  blocks: Record<string, unknown>;
  metadata: ContextMetadata;
  exported: string[];
  parentBlockNames: string[] | null;
  validatedBlocks: boolean;
  parentContext: Context | null;
  validateBlocks: () => void;
  setParentBlockNames: (names: string[] | null) => void;
  setVariable: (name: string, value: unknown) => void;
  addBlock: (name: string, block: BlockFn) => Context;
  addExport: (name: string) => void;
  fork: (data?: Record<string, unknown>) => Context;
  [key: symbol]: unknown;
}

type Context = MutableContext;

const getKeys = (obj: Record<string, unknown>): string[] => keys(obj);

const throwBlockNotFoundError = (name: string, location: BlockLocation | undefined, lineno: number | null, colno: number | null): never => {
  throw createLog(
    'error',
    ERROR_DEFINITIONS.UNDEFINED_BLOCK,
    { name },
    name,
    {
      lineno: lineno ?? location?.lineno ?? null,
      colno: colno ?? location?.colno ?? null,
      phase: 'render',
      lineBase: 'zero',
    },
  );
};

const throwNoSuperBlockError = (name: string, lineno: number | null, colno: number | null): never => {
  throw createLog('error', ERROR_DEFINITIONS.NO_SUPER_BLOCK, { name }, name, {
    lineno,
    colno,
    phase: 'render',
    lineBase: 'zero',
  });
};

const createDefaultEnv = (): Env => ({
  opts: {
    dev: false,
    autoescape: true,
    undefined: 'default',
  },
  getFilter: () => null,
  getTest: () => null,
});

const createContext = (
  ctx: Record<string, unknown> = {},
  blocks: Record<string, unknown> = {},
  env: Env | null = null,
  metadata: ContextMetadata = {},
): Context => {
  const context: Context = {
    env: env ?? createDefaultEnv(),
    ctx: { ...ctx },
    blocks: {},
    metadata: metadata ?? {},
    exported: [] as string[],
    parentBlockNames: null as string[] | null,
    validatedBlocks: false,
    parentContext: null as Context | null,
    validateBlocks: () => {
      if (context.validatedBlocks) { return; }
      context.validatedBlocks = true;

      if (context.parentBlockNames !== null) {
        const parentBlockNames = new Set(context.parentBlockNames);
        const blockName = find(
          getKeys(context.blocks),
          name => !parentBlockNames.has(name),
        );
        if (blockName) {
          throwBlockNotFoundError(blockName, context.metadata.blockLocations?.[blockName], null, null);
        }
      }
    },
    setParentBlockNames: (names: string[] | null) => { context.parentBlockNames = names; },
    lookup: (name: string) => context.ctx[name],
    setVariable: (name: string, value: unknown) => { context.ctx[name] = value; },
    addBlock: (name, block) => {
      const existing = context.blocks[name];
      const next = existing ? (Array.isArray(existing) ? [...existing, block] : [existing, block]) : [block];
      context.blocks[name] = next;
      return context;
    },
    getBlock: (name, lineno = null, colno = null) => {
      context.validateBlocks();
      const block = context.blocks[name];
      const location = context.metadata.blockLocations?.[name];
      if (!block) {
        return throwBlockNotFoundError(name, location, lineno, colno);
      }
      const firstBlock = Array.isArray(block) ? block[0] : block;
      if (!firstBlock) {
        return throwBlockNotFoundError(name, location, lineno, colno);
      }
      return firstBlock;
    },
    getSuper: (envObj, name, block, frame, runtime, lineno = null, colno = null) => {
      const blockList = context.blocks[name];
      if (!blockList || !Array.isArray(blockList)) {
        return throwNoSuperBlockError(name, lineno, colno);
      }
      const idx = blockList.indexOf(block);
      const blk = blockList[idx + 1];

      if (idx === -1 || !blk) {
        return throwNoSuperBlockError(name, lineno, colno);
      }

      return blk(envObj, context, frame, runtime);
    },
    addExport: (name) => { context.exported = [...context.exported, name]; },
    getExported: () =>
      Object.fromEntries(context.exported.map(name => [name, context.ctx[name]])),
    fork: (data = {}) => {
      const childCtx = createContext(data, {}, context.env);
      childCtx.parentContext = context;
      return childCtx;
    },
    getVariables: () => {
      if (context.parentContext) {
        const parentVars = context.parentContext.getVariables();
        return { ...parentVars, ...context.ctx };
      }
      return context.ctx;
    },
    [CONTEXT_KEY]: true,
  };

  registerBlocks(context, blocks);
  return context;
};

const registerBlocks = (ctxObj: Context, blocksInput: Record<string, unknown>): void => {
  for (const name of getKeys(blocksInput)) {
    const block = blocksInput[name];
    if (block) {
      ctxObj.addBlock(name, block as BlockFn);
    }
  }
};

const isContext = (obj: unknown): obj is Context => Boolean(obj) && (obj as { [k: symbol]: unknown })[CONTEXT_KEY] === true;

export { createContext, isContext };
export type { BlockLocation, Context, BlockFn };