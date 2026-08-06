import { ERROR_DEFINITIONS, createLog } from '@nunjucks/log';
import type { IncludeChain } from '@nunjucks/log';
import { keys } from 'remeda';

const CONTEXT_KEY = Symbol('Context');

interface Env {
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

const createDefaultEnv = (): Env => ({
  opts: {
    dev: false,
    autoescape: true,
    undefined: 'default',
  },
  getFilter: () => null,
  getTest: () => null,
});

type ContextEnv = Env;

interface BlockLocation {
  lineno?: number | null;
  colno?: number | null;
}

interface ContextMetadata {
  blockLocations?: Record<string, BlockLocation>;
}

type Metadata = ContextMetadata;

interface Context {
  env: Env;
  ctx: Record<string, unknown>;
  blocks: Record<string, unknown>;
  metadata: Metadata;
  blockLocations: Record<string, BlockLocation>;
  exported: string[];
  parentBlockNames: string[] | null;
  validatedBlocks: boolean;
  parentContext: Context | null;
  _autoescape: boolean;
  validateBlocks: () => void;
  setParentBlockNames: (names: string[] | null) => void;
  lookup: (name: string) => unknown;
  setVariable: (name: string, val: unknown) => void;
  addBlock: (name: string, block: (...args: unknown[]) => unknown) => Context;
  getBlock: (name: string, lineno?: number | null, colno?: number | null) => (...args: unknown[]) => unknown;
  getSuper: (
    envObj: unknown,
    name: string,
    block: (...args: unknown[]) => unknown,
    frame: unknown,
    runtime: unknown,
    lineno?: number | null,
    colno?: number | null,
  ) => unknown;
  addExport: (name: string) => void;
  getExported: () => Record<string, unknown>;
  fork: (data?: Record<string, unknown>) => Context;
  getVariables: () => Record<string, unknown>;
  [key: symbol]: unknown;
}

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

function createContext(
  ctx: Record<string, unknown> = {},
  blocks: Record<string, (...args: unknown[]) => unknown> = {},
  env: Env | null = null,
  metadata: Metadata = {},
): Context {
  const state = {
    env: env || createDefaultEnv(),
    ctx: { ...ctx },
    blocks: {} as Record<string, unknown>,
    metadata: metadata ?? {},
    blockLocations: (metadata?.blockLocations ?? {}) as Record<string, BlockLocation>,
    exported: [] as string[],
    parentBlockNames: null as string[] | null,
    validatedBlocks: false,
    parentContext: null as Context | null,
    _autoescape: true,
  };

  const validateBlocks = () => {
    if (state.validatedBlocks) { return; }
    state.validatedBlocks = true;

    if (state.parentBlockNames !== null) {
      const parentBlockNames = new Set(state.parentBlockNames);
      const [blockName] = getKeys(state.blocks).filter((name) => !parentBlockNames.has(name));
      if (blockName) {
        throwBlockNotFoundError(blockName, state.blockLocations[blockName], null, null);
      }
    }
  };

  const lookup = (name: string): unknown => state.ctx[name];
  const setVariable = (name: string, val: unknown): void => { state.ctx[name] = val; };

  const addBlock = (name: string, block: (...args: unknown[]) => unknown): Context => {
    const existing = state.blocks[name];
    if (Array.isArray(existing)) {
      existing.push(block);
    } else {
      state.blocks[name] = existing ? [existing, block] : [block];
    }
    return context;
  };

  const getBlock = (name: string, lineno: number | null = null, colno: number | null = null): (...args: unknown[]) => unknown => {
    validateBlocks();
    const block = state.blocks[name];
    if (!block) {
      return throwBlockNotFoundError(name, state.blockLocations[name], lineno, colno);
    }
    const firstBlock = Array.isArray(block) ? block[0] : block;
    if (!firstBlock) {
      return throwBlockNotFoundError(name, state.blockLocations[name], lineno, colno);
    }
    return firstBlock;
  };

  const getSuper = (
    envObj: unknown,
    name: string,
    block: (...args: unknown[]) => unknown,
    frame: unknown,
    runtime: unknown,
    lineno: number | null = null,
    colno: number | null = null,
  ): unknown => {
    const blockList = state.blocks[name];
    if (!blockList || !Array.isArray(blockList)) {
      return throwNoSuperBlockError(name, lineno, colno);
    }
    const idx = blockList.indexOf(block);
    const blk = blockList[idx + 1];

    if (idx === -1 || !blk) {
      return throwNoSuperBlockError(name, lineno, colno);
    }

    return blk(envObj, context, frame, runtime);
  };

  const addExport = (name: string): void => { state.exported.push(name); };

  const getExported = (): Record<string, unknown> =>
    Object.fromEntries(state.exported.map(name => [name, state.ctx[name]]));

  const fork = (data: Record<string, unknown> = {}): Context => {
    const childCtx = createContext(data, {}, state.env);
    childCtx.parentContext = context;
    return childCtx;
  };

  const getVariables = (): Record<string, unknown> => {
    if (state.parentContext) {
      const parentVars = state.parentContext.getVariables();
      return { ...parentVars, ...state.ctx };
    }
    return state.ctx;
  };

  const registerBlocks = (ctxObj: Context, blocksInput: Record<string, (...args: unknown[]) => unknown>): void => {
    getKeys(blocksInput).forEach(name => {
      const block = blocksInput[name];
      if (block) {
        ctxObj.addBlock(name, block);
      }
    });
  };

  const context: Context = {
    get env() { return state.env; },
    set env(v) { state.env = v; },
    get ctx() { return state.ctx; },
    set ctx(v) { state.ctx = v; },
    get blocks() { return state.blocks; },
    set blocks(v) { state.blocks = v; },
    get metadata() { return state.metadata; },
    set metadata(v) { state.metadata = v; },
    get blockLocations() { return state.blockLocations; },
    set blockLocations(v) { state.blockLocations = v; },
    get exported() { return state.exported; },
    set exported(v) { state.exported = v; },
    get parentBlockNames() { return state.parentBlockNames; },
    set parentBlockNames(v) { state.parentBlockNames = v; },
    get validatedBlocks() { return state.validatedBlocks; },
    set validatedBlocks(v) { state.validatedBlocks = v; },
    get parentContext() { return state.parentContext; },
    set parentContext(v) { state.parentContext = v; },
    get _autoescape() { return state._autoescape; },
    set _autoescape(v) { state._autoescape = v; },
    validateBlocks,
    setParentBlockNames: (names: string[] | null) => { state.parentBlockNames = names; },
    lookup,
    setVariable,
    addBlock,
    getBlock,
    getSuper,
    addExport,
    getExported,
    fork,
    getVariables,
    [CONTEXT_KEY]: true,
  };

  registerBlocks(context, blocks);
  return context;
}

const isContext = (obj: unknown): obj is Context => Boolean(obj) && (obj as { [k: symbol]: unknown })[CONTEXT_KEY] === true;

export { createContext, isContext };
export type { Env, ContextEnv, BlockLocation, ContextMetadata, Context };
