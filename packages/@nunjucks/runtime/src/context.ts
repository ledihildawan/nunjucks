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
  parentBlockNames: string[] | null;
  validatedBlocks: boolean;
  parentContext: Context | null;
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
  let envVar: Env = env || createDefaultEnv();
  let ctxVar: Record<string, unknown> = { ...ctx };
  let blocksVar: Record<string, Array<(...args: unknown[]) => unknown>> = {};
  let metadataVar: Metadata = metadata || {};
  let blockLocationsVar: Record<string, BlockLocation> = metadataVar.blockLocations || {};
  let exportedVar: string[] = [];
  let parentBlockNamesVar: string[] | null = null;
  let validatedBlocksVar = false;
  let parentContextVar: Context | null = null;

  const validateBlocks = () => {
    if (validatedBlocksVar) return;
    validatedBlocksVar = true;

    if (parentBlockNamesVar !== null) {
      const parentBlockNames = new Set(parentBlockNamesVar);
      const childOnlyBlocks = getKeys(blocksVar).filter((name) => !parentBlockNames.has(name));
      if (childOnlyBlocks.length > 0) {
        const blockName = childOnlyBlocks[0]!;
        const location = blockLocationsVar[blockName] || {};
        throw createLog(
          'error',
          ERROR_DEFINITIONS.UNDEFINED_BLOCK!,
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
  };

  const lookup = (name: string): unknown => {
    if (name in envVar.globals && !(name in ctxVar)) {
      return envVar.globals[name];
    }
    return ctxVar[name];
  };

  const setVariable = (name: string, val: unknown): void => {
    ctxVar[name] = val;
  };

  const addBlock = (name: string, block: (...args: unknown[]) => unknown): Context => {
    blocksVar[name] = blocksVar[name] || [];
    blocksVar[name].push(block);
    return context;
  };

  const getBlock = (name: string, lineno: number | null = null, colno: number | null = null): (...args: unknown[]) => unknown => {
    validateBlocks();
    if (!blocksVar[name]) {
      const location = blockLocationsVar[name] || {};
      throw createLog(
        'error',
        ERROR_DEFINITIONS.UNDEFINED_BLOCK!,
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
    return blocksVar[name]![0]!;
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
    const blockList = blocksVar[name];
    if (!blockList) {
      throw createLog('error', ERROR_DEFINITIONS.NO_SUPER_BLOCK!, { name }, name, {
        lineno,
        colno,
        phase: 'render',
        lineBase: 'zero',
      });
    }
    const idx = blockList.indexOf(block);
    const blk = blockList[idx + 1];

    if (idx === -1 || !blk) {
      throw createLog('error', ERROR_DEFINITIONS.NO_SUPER_BLOCK!, { name }, name, {
        lineno,
        colno,
        phase: 'render',
        lineBase: 'zero',
      });
    }

    return blk(envObj, context, frame, runtime);
  };

  const addExport = (name: string): void => {
    exportedVar.push(name);
  };

  const getExported = (): Record<string, unknown> => {
    const exported: Record<string, unknown> = {};
    exportedVar.forEach((name) => {
      exported[name] = ctxVar[name];
    });
    return exported;
  };

  const fork = (data: Record<string, unknown> = {}): Context => {
    const childCtx = createContext(data, {}, envVar);
    childCtx.parentContext = context;
    return childCtx;
  };

  const getVariables = (): Record<string, unknown> => {
    if (parentContextVar) {
      const parentVars = parentContextVar.getVariables();
      return { ...parentVars, ...ctxVar };
    }
    return ctxVar;
  };

  const context: Context = {
    get env() { return envVar; },
    set env(v) { envVar = v; },
    get ctx() { return ctxVar; },
    set ctx(v) { ctxVar = v; },
    get blocks() { return blocksVar; },
    set blocks(v) { blocksVar = v; },
    get metadata() { return metadataVar; },
    set metadata(v) { metadataVar = v; },
    get blockLocations() { return blockLocationsVar; },
    set blockLocations(v) { blockLocationsVar = v; },
    get exported() { return exportedVar; },
    set exported(v) { exportedVar = v; },
    get parentBlockNames() { return parentBlockNamesVar; },
    set parentBlockNames(v) { parentBlockNamesVar = v; },
    get validatedBlocks() { return validatedBlocksVar; },
    set validatedBlocks(v) { validatedBlocksVar = v; },
    get parentContext() { return parentContextVar; },
    set parentContext(v) { parentContextVar = v; },
    validateBlocks,
    setParentBlockNames: (names: string[] | null) => { parentBlockNamesVar = names; },
    lookup,
    setVariable,
    addBlock,
    getBlock,
    getSuper,
    addExport,
    getExported,
    fork,
    getVariables,
  };

  getKeys(blocks).forEach((name) => {
    const block = blocks[name];
    if (block) {
      context.addBlock(name, block);
    }
  });

  context[CONTEXT_KEY] = true;
  return context;
}

export const isContext = (obj: unknown): boolean => !!obj && (obj as { [k: symbol]: unknown })[CONTEXT_KEY] === true;
