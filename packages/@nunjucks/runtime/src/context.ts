import { ERROR_DEFINITIONS, createLog } from '@nunjucks/log';
import type { IncludeChain } from '@nunjucks/log';
import type { NodeLocation, UndefinedMode } from '@nunjucks/shared';
import { find, forEach, keys } from 'remeda';
import { collectString } from './collect-stream.ts';

const CONTEXT_KEY = Symbol('Context');

export interface Env {
  opts: {
    dev: boolean;
    autoescape: boolean;
    undefined: UndefinedMode;
  };
  getFilter: (name: string, lineno: number | null, colno: number | null) => unknown;
  getTest: (name: string, lineno: number | null, colno: number | null) => unknown;
  getTemplate?: (name: string, eagerCompile?: boolean, includeChain?: IncludeChain | null, ignoreMissing?: boolean) => unknown;
  emit?: (event: string, ...args: unknown[]) => void;
  renderingTemplates?: Set<string | undefined>;
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
  parentContext: Context | null;
  setParentBlockNames: (names: string[] | null) => Context;
  setVariable: (name: string, value: unknown) => Context;
  addBlock: (name: string, block: BlockFn) => Context;
  addExport: (name: string) => Context;
  fork: (data?: Record<string, unknown>) => Context;
  validateBlocks: () => void;
  [key: symbol]: unknown;
}

type Context = MutableContext;

interface ContextState {
  env: Env;
  ctx: Record<string, unknown>;
  blocks: Record<string, unknown>;
  metadata: ContextMetadata;
  exported: string[];
  parentBlockNames: string[] | null;
  parentContext: Context | null;
}

const getKeys = (record: Record<string, unknown>): string[] => keys(record);

const throwBlockNotFoundError = ({ name, location, lineno, colno }: { name: string; location: BlockLocation | undefined; lineno: number | null; colno: number | null }): never => {
  throw createLog('error', {
    def: ERROR_DEFINITIONS.UNDEFINED_BLOCK,
    params: { name },
    subject: name,
    context: { lineno: lineno ?? location?.lineno ?? null, colno: colno ?? location?.colno ?? null, phase: 'render', lineBase: 'zero' },
  });
};

const throwNoSuperBlockError = (name: string, lineno: number | null, colno: number | null): never => {
  throw createLog('error', {
    def: ERROR_DEFINITIONS.NO_SUPER_BLOCK,
    params: { name },
    subject: name,
    context: { lineno, colno, phase: 'render', lineBase: 'zero' },
  });
};

const createDefaultEnv = (): Env => ({
  opts: { dev: false, autoescape: true, undefined: 'default' },
  getFilter: () => null,
  getTest: () => null,
});

interface CreateContextOptions {
  ctx?: Record<string, unknown>;
  blocks?: Record<string, unknown>;
  env?: Env | null;
  metadata?: ContextMetadata;
}

// WHY: the Context object is render-time execution state. The user-facing write methods (setVariable/addBlock/addExport/setParentBlockNames) return a NEW Context (immutable update) so generated code reassigns `context = context.setX(...)`; reads (lookup/getBlock/getSuper/getExported) are pure. validateBlocks is a pure check (no flag). parentContext/fork preserve the scope-chain. This keeps context-creation local while removing shared-reference mutation.
const makeContext = (state: ContextState): Context => {
  const context: Context = {
    env: state.env,
    ctx: state.ctx,
    blocks: state.blocks,
    metadata: state.metadata,
    exported: state.exported,
    parentBlockNames: state.parentBlockNames,
    parentContext: state.parentContext,

    setParentBlockNames(names: string[] | null): Context {
      return makeContext({ ...state, parentBlockNames: names });
    },

    lookup(name: string): unknown {
      return state.ctx[name];
    },

    setVariable(name: string, value: unknown): Context {
      return makeContext({ ...state, ctx: { ...state.ctx, [name]: value } });
    },

    addBlock(name: string, block: BlockFn): Context {
      const existing = state.blocks[name];
      const next = existing ? (Array.isArray(existing) ? [...existing, block] : [existing, block]) : [block];
      return makeContext({ ...state, blocks: { ...state.blocks, [name]: next } });
    },

    validateBlocks(): void {
      if (state.parentBlockNames !== null) {
        const parentBlockNames = new Set(state.parentBlockNames);
        const blockName = find(getKeys(state.blocks), (name) => !parentBlockNames.has(name));
        if (blockName) {
          throwBlockNotFoundError({ name: blockName, location: state.metadata.blockLocations?.[blockName], lineno: null, colno: null });
        }
      }
    },

    getBlock(name: string, lineno: number | null = null, colno: number | null = null): BlockFn {
      context.validateBlocks();
      const block = state.blocks[name];
      const location = state.metadata.blockLocations?.[name];
      if (!block) {
        return throwBlockNotFoundError({ name, location, lineno, colno });
      }
      const firstBlock = Array.isArray(block) ? block[0] : block;
      if (!firstBlock) {
        return throwBlockNotFoundError({ name, location, lineno, colno });
      }
      return firstBlock as BlockFn;
    },

    getSuper(envObj: unknown, name: string, block: BlockFn, frame: unknown, runtime: unknown, lineno: number | null = null, colno: number | null = null): unknown {
      const blockList = state.blocks[name];
      if (!blockList || !Array.isArray(blockList)) {
        return throwNoSuperBlockError(name, lineno, colno);
      }
      const idx = blockList.indexOf(block);
      const blk = blockList[idx + 1];
      if (idx === -1 || !blk) {
        return throwNoSuperBlockError(name, lineno, colno);
      }
      // WHY: Option C — block functions are async generators; drain the super block into a string so it can be markSafe'd and used as a value. BlockFn is typed `=> unknown` (loose); the runtime guarantee is AsyncGenerator, hence the narrowing cast.
      return collectString((blk as BlockFn)(envObj, context, frame, runtime) as AsyncGenerator<string, unknown>);
    },

    addExport(name: string): Context {
      return makeContext({ ...state, exported: [...state.exported, name] });
    },

    getExported(): Record<string, unknown> {
      return Object.fromEntries(state.exported.map((name) => [name, state.ctx[name]]));
    },

    fork(data: Record<string, unknown> = {}): Context {
      const child = makeContext({
        env: state.env,
        ctx: { ...data },
        blocks: {},
        metadata: {},
        exported: [],
        parentBlockNames: null,
        parentContext: context,
      });
      return child;
    },

    getVariables(): Record<string, unknown> {
      if (state.parentContext) {
        const parentVars = state.parentContext.getVariables();
        return { ...parentVars, ...state.ctx };
      }
      return state.ctx;
    },

    [CONTEXT_KEY]: true,
  };

  return context;
};

const createContext = ({ ctx = {}, blocks = {}, env = null, metadata = {} }: CreateContextOptions = {}): Context => {
  const context = makeContext({
    env: env ?? createDefaultEnv(),
    ctx: { ...ctx },
    blocks: {},
    metadata: metadata ?? {},
    exported: [] as string[],
    parentBlockNames: null as string[] | null,
    parentContext: null as Context | null,
  });

  let current = context;
  forEach(getKeys(blocks), (name) => {
    const block = blocks[name];
    if (block) {
      current = current.addBlock(name, block as BlockFn);
    }
  });
  return current;
};

const isContext = (value: unknown): value is Context =>
  Boolean(value) && (value as { [k: symbol]: unknown })[CONTEXT_KEY] === true;

export { createContext, isContext };
export type { BlockLocation, Context, BlockFn };
