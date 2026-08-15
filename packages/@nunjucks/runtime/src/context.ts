import type { IncludeChain } from '@nunjucks/error-formatter';
import { collectString } from '@nunjucks/lib/collect-stream';
import type { NodeLocation } from '@nunjucks/shared';
import { find, keys, reduce } from 'remeda';
import type { UndefinedMode } from './runtime-contract/undefined-modes.ts';
import {
  throwBlockNotFoundError,
  throwBlockNotFunctionError,
  throwNoSuperBlockError,
} from './context-errors.ts';

const CONTEXT_KEY = Symbol('Context');

interface GetTemplateOptions {
  name: string;
  eagerCompile?: boolean;
  includeChain?: IncludeChain | null;
  ignoreMissing?: boolean;
}

export interface Env {
  opts: {
    dev: boolean;
    autoescape: boolean;
    undefined: UndefinedMode;
  };
  getFilter: (name: string, lineno: number | null, colno: number | null) => unknown;
  getTest: (name: string, lineno: number | null, colno: number | null) => unknown;
  getExtension?: (name: string) => unknown;
  getTemplate?: (options: GetTemplateOptions) => unknown;
  emit?: (event: string, ...args: unknown[]) => void;
  renderingTemplates?: Set<string | undefined>;
}

type BlockLocation = NodeLocation;

export interface ContextMetadata {
  blockLocations?: Record<string, BlockLocation>;
}

type BlockFn = (...args: unknown[]) => unknown;

interface GetSuperOptions {
  envObj: unknown;
  name: string;
  block: BlockFn;
  frame: unknown;
  runtime: unknown;
  lineno?: number | null;
  colno?: number | null;
}

type GetSuperFn = (options: GetSuperOptions) => unknown;

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
  fork: (childContext?: Record<string, unknown>) => Context;
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
const createContextFromState = (state: ContextState): Context => {
  const context: Context = {
    env: state.env,
    ctx: state.ctx,
    blocks: state.blocks,
    metadata: state.metadata,
    exported: state.exported,
    parentBlockNames: state.parentBlockNames,
    parentContext: state.parentContext,

    setParentBlockNames(names: string[] | null): Context {
      return createContextFromState({ ...state, parentBlockNames: names });
    },

    lookup(name: string): unknown {
      return state.ctx[name];
    },

    setVariable(name: string, value: unknown): Context {
      return createContextFromState({ ...state, ctx: { ...state.ctx, [name]: value } });
    },

    addBlock(name: string, block: BlockFn): Context {
      if (typeof block !== 'function') {
        return throwBlockNotFunctionError({ name });
      }
      const existing = state.blocks[name];
      const next = existing
        ? Array.isArray(existing)
          ? [...existing, block]
          : [existing, block]
        : [block];
      return createContextFromState({ ...state, blocks: { ...state.blocks, [name]: next } });
    },

    validateBlocks(): void {
      if (state.parentBlockNames !== null) {
        const parentBlockNameSet = new Set(state.parentBlockNames);
        const blockName = find(keys(state.blocks), (name) => !parentBlockNameSet.has(name));
        if (blockName) {
          throwBlockNotFoundError({
            name: blockName,
            location: state.metadata.blockLocations?.[blockName],
            lineno: null,
            colno: null,
          });
        }
      }
    },

    getBlock(name: string, lineno: number | null = null, colno: number | null = null): BlockFn {
      context.validateBlocks();
      const storedBlock = state.blocks[name];
      const location = state.metadata.blockLocations?.[name];
      if (!storedBlock) {
        return throwBlockNotFoundError({ name, location, lineno, colno });
      }
      const firstBlock = Array.isArray(storedBlock) ? storedBlock[0] : storedBlock;
      if (!firstBlock) {
        return throwBlockNotFoundError({ name, location, lineno, colno });
      }
      return firstBlock as BlockFn;
    },

    getSuper({
      envObj,
      name,
      block,
      frame,
      runtime,
      lineno = null,
      colno = null,
    }: GetSuperOptions): unknown {
      const blockList = state.blocks[name];
      if (!blockList || !Array.isArray(blockList)) {
        return throwNoSuperBlockError({ name, lineno, colno });
      }
      const idx = blockList.indexOf(block);
      const parentBlock = blockList[idx + 1];
      if (idx === -1 || !parentBlock) {
        return throwNoSuperBlockError({ name, lineno, colno });
      }
      // WHY: Option C — block functions are async generators; drain the super block into a string so it can be markSafe'd and used as a value. BlockFn is typed `=> unknown` (loose); the runtime guarantee is AsyncGenerator, hence the narrowing cast.
      return collectString(
        (parentBlock as BlockFn)(envObj, context, frame, runtime) as AsyncGenerator<string, unknown>
      );
    },

    addExport(name: string): Context {
      return createContextFromState({ ...state, exported: [...state.exported, name] });
    },

    getExported(): Record<string, unknown> {
      return Object.fromEntries(state.exported.map((name) => [name, state.ctx[name]]));
    },

    fork(childContext: Record<string, unknown> = {}): Context {
      const child = createContextFromState({
        env: state.env,
        ctx: { ...childContext },
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

const createContext = ({
  ctx = {},
  blocks: initialBlocks = {},
  env = null,
  metadata = {},
}: CreateContextOptions = {}): Context => {
  const context = createContextFromState({
    env: env ?? createDefaultEnv(),
    ctx: { ...ctx },
    blocks: {},
    metadata: metadata ?? {},
    exported: [] as string[],
    parentBlockNames: null as string[] | null,
    parentContext: null as Context | null,
  });

  return reduce(
    keys(initialBlocks),
    (acc, name) => {
      const block = initialBlocks[name];
      if (block) {
        return acc.addBlock(name, block as BlockFn);
      }
      return acc;
    },
    context
  );
};

export type { BlockFn, BlockLocation, Context, GetTemplateOptions };
export { createContext };
