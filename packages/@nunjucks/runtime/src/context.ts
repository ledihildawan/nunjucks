// CONTEXT - Runtime context management with blocks and exports
// Import directly: import { createContext } from '@nunjucks/runtime/context'

import { ERROR_DEFINITIONS, createLog } from '@nunjucks/log';

const CONTEXT_KEY = Symbol('Context');

const createDefaultEnv = (): Env => ({
  globals: {},
  getFilter: () => null,
  opts: {},
});

interface Env {
  globals: Record<string, unknown>;
  getFilter: (name: string) => unknown;
  opts: Record<string, unknown>;
}

interface BlockLocation {
  lineno?: number | null;
  colno?: number | null;
}

interface Metadata {
  blockLocations?: Record<string, BlockLocation>;
}

export interface Context {
  env: Env;
  ctx: Record<string, unknown>;
  blocks: Record<string, Array<(...args: unknown[]) => unknown>>;
  metadata: Metadata;
  blockLocations: Record<string, BlockLocation>;
  exported: string[];
  _parentBlockNames: string[] | null;
  _validatedBlocks: boolean;
  _parentContext: Context | null;
  init: (ctxArg: Record<string, unknown>, blocksArg: Record<string, (...args: unknown[]) => unknown>, envArg: Env | null, metadataArg: Metadata) => void;
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

const getKeys = (obj: Record<string, unknown>): string[] => Object.keys(obj);

export function createContext(
  ctx: Record<string, unknown> = {},
  blocks: Record<string, (...args: unknown[]) => unknown> = {},
  env: Env | null = null,
  metadata: Metadata = {},
): Context {
  const obj = {
    name: 'Context',
    init(this: Context, ctxArg: Record<string, unknown>, blocksArg: Record<string, (...args: unknown[]) => unknown>, envArg: Env | null, metadataArg: Metadata): void {
      this.env = envArg || createDefaultEnv();
      this.ctx = { ...ctxArg };
      this.blocks = {};
      this.metadata = metadataArg || {};
      this.blockLocations = this.metadata.blockLocations || {};
      this.exported = [];
      this._parentBlockNames = null;
      this._validatedBlocks = false;
      this._parentContext = null;

      getKeys(blocksArg as Record<string, unknown>).forEach((name) => {
        this.addBlock(name, blocksArg[name]);
      });
    },
    validateBlocks(this: Context): void {
      if (this._validatedBlocks) return;
      this._validatedBlocks = true;

      if (this._parentBlockNames !== null) {
        const parentBlockNames = new Set(this._parentBlockNames);
        const childOnlyBlocks = getKeys(this.blocks || {}).filter((name) => !parentBlockNames.has(name));
        if (childOnlyBlocks.length > 0) {
          const blockName = childOnlyBlocks[0];
          const location = this.blockLocations[blockName] || {};
          throw createLog(
            'error',
            ERROR_DEFINITIONS.UNDEFINED_BLOCK,
            { name: blockName },
            blockName,
            {
              lineno: location.lineno ?? null,
              colno: location.colno ?? null,
              lineBase: 'zero',
              phase: 'render',
            },
          );
        }
      }
    },
    setParentBlockNames(this: Context, names: string[] | null): void {
      this._parentBlockNames = names;
    },
    lookup(this: Context, name: string): unknown {
      if (name in this.env.globals && !(name in this.ctx)) {
        return this.env.globals[name];
      }
      return this.ctx[name];
    },
    setVariable(this: Context, name: string, val: unknown): void {
      this.ctx[name] = val;
    },
    addBlock(this: Context, name: string, block: (...args: unknown[]) => unknown): Context {
      this.blocks[name] = this.blocks[name] || [];
      this.blocks[name].push(block);
      return this;
    },
    getBlock(this: Context, name: string, lineno: number | null = null, colno: number | null = null): (...args: unknown[]) => unknown {
      this.validateBlocks();
      if (!this.blocks[name]) {
        const location = this.blockLocations[name] || {};
        throw createLog(
          'error',
          ERROR_DEFINITIONS.UNDEFINED_BLOCK,
          { name },
          name,
          {
            lineno: lineno ?? location.lineno ?? null,
            colno: colno ?? location.colno ?? null,
            phase: 'render',
            lineBase: 'zero',
          },
        );
      }
      return this.blocks[name][0];
    },
    getSuper(
      this: Context,
      envObj: unknown,
      name: string,
      block: (...args: unknown[]) => unknown,
      frame: unknown,
      runtime: unknown,
      lineno: number | null = null,
      colno: number | null = null,
    ): unknown {
      const blockList = this.blocks[name];
      if (!blockList) {
        throw createLog('error', ERROR_DEFINITIONS.NO_SUPER_BLOCK, { name }, name, {
          lineno,
          colno,
          phase: 'render',
          lineBase: 'zero',
        });
      }
      const idx = blockList.indexOf(block);
      const blk = blockList[idx + 1];

      if (idx === -1 || !blk) {
        throw createLog('error', ERROR_DEFINITIONS.NO_SUPER_BLOCK, { name }, name, {
          lineno,
          colno,
          phase: 'render',
          lineBase: 'zero',
        });
      }

      return blk(envObj, this, frame, runtime);
    },
    addExport(this: Context, name: string): void {
      this.exported.push(name);
    },
    getExported(this: Context): Record<string, unknown> {
      const exported: Record<string, unknown> = {};
      this.exported.forEach((name) => {
        exported[name] = this.ctx[name];
      });
      return exported;
    },
    fork(this: Context, data: Record<string, unknown> = {}): Context {
      const childCtx = createContext(data, {}, this.env);
      childCtx._parentContext = this;
      return childCtx;
    },
    getVariables(this: Context): Record<string, unknown> {
      if (this._parentContext) {
        const parentVars = this._parentContext.getVariables();
        return { ...parentVars, ...this.ctx };
      }
      return this.ctx;
    },
  } as unknown as Context;

  obj[CONTEXT_KEY] = true;
  obj.init(ctx, blocks, env, metadata);
  return obj;
}

export const isContext = (obj: unknown): boolean => !!obj && (obj as { [k: symbol]: unknown })[CONTEXT_KEY] === true;
