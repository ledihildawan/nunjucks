import { createContext, createSandboxedContext, type ContextEnv, type BlockLocation, type Frame } from '@nunjucks/runtime';
import { createLog } from '@nunjucks/log';
import { getError } from '@nunjucks/log';
import { makeGetFilter } from './executor-filters.ts';
import { getRenderFunction, getRuntimeHelpers, buildSandboxOptions, buildSandboxedRuntime } from './executor-runtime.ts';

interface ExecuteConfig {
  env?: ContextEnv;
  autoescape?: boolean;
  filters?: Record<string, (...args: unknown[]) => unknown>;
  tests?: Record<string, (...args: unknown[]) => unknown>;
  dev?: boolean;
  sandboxAllowlist?: string[];
  sandboxMode?: string;
  sandboxEnvironment?: string;
}

const buildRuntime = (config: ExecuteConfig): Record<string, unknown> => {
  const runtime = getRuntimeHelpers();

  if (config.sandboxAllowlist || config.sandboxMode) {
    const sandboxOptions = buildSandboxOptions(config);
    return buildSandboxedRuntime(runtime, sandboxOptions);
  }

  return runtime;
};

const buildGetTest = (tests: Record<string, (...args: unknown[]) => unknown>) => (
  name: string,
  lineno: number | null,
  colno: number | null
) => {
  const test = tests[name];
  if (test) { return test; }
  throw createLog('error', getError('UNDEFINED_TEST'), { name }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
};

const buildContextObject = (
  context: Record<string, unknown>,
  config: ExecuteConfig,
  runtime: Record<string, unknown>
): Record<string, unknown> => {
  if (config.env) {
    const ctx = createContext(context, {}, config.env as Parameters<typeof createContext>[2]) as unknown as Record<string, unknown>;
    ctx._autoescape = config.autoescape ?? true;
    return ctx;
  }

  const exported: string[] = [];
  const ctx: Record<string, unknown> = {
    ...context,
    _autoescape: config.autoescape ?? true,
    lookup: (key: string) => {
      if (key in ctx) {
        return ctx[key];
      }
      if (key in runtime) {
        return runtime[key];
      }
    },
    setVariable: (name: string, val: unknown) => {
      ctx[name] = val;
    },
    addExport: (name: string) => {
      exported.push(name);
    },
    getExported: () => {
      const result: Record<string, unknown> = {};
      for (const name of exported) {
        result[name] = ctx[name];
      }
      return result;
    },
    getSuper: (_envObj: unknown, name: string, _block: unknown, _frame: Frame, lineno: number | null = null, colno: number | null = null) => {
      throw createLog('error', getError('NO_SUPER_BLOCK'), { name }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
    }
  };
  return ctx;
};

const executeNonSandbox = async (
  code: string,
  ctx: Record<string, unknown>,
  frame: Frame,
  env: unknown,
  runtime: Record<string, unknown>
): Promise<unknown> => {
  const { render, blocks, blockMeta } = getRenderFunction(code);

  if (ctx.env) {
    const newCtx = createContext(
      {},
      blocks as Record<string, (...args: unknown[]) => unknown>,
      ctx.env as unknown as ContextEnv,
      { blockLocations: blockMeta as Record<string, BlockLocation> }
    ) as unknown as Record<string, unknown>;
    newCtx._autoescape = true;
    return await render(env, newCtx, frame, runtime);
  }

  ctx.blocks = blocks as Record<string, (...args: unknown[]) => unknown>;
  ctx.getBlock = (name: string) => {
    if (!blocks[name]) {
      throw createLog('error', getError('UNDEFINED_BLOCK'), { name }, name, { phase: 'render' });
    }
    return blocks[name];
  };

  return await render(env, ctx, frame, runtime);
};

const execute = async (
  code: string,
  context: Record<string, unknown>,
  frame: Frame,
  env: unknown,
  config: ExecuteConfig = {}
): Promise<unknown> => {
  const runtime = buildRuntime(config);

  if (config.filters) {
    runtime.getFilter = makeGetFilter(config.filters, context, { env: config.env as { getFilter: (name: string, lineno: number | null, colno: number | null) => unknown } }, Boolean(config.env));
  }

  if (config.tests) {
    runtime.getTest = buildGetTest(config.tests);
  }

  if (config.env) {
    runtime.context = createSandboxedContext(context, true, buildSandboxOptions(config));
  } else {
    runtime.context = context;
  }

  const ctx = buildContextObject(context, config, runtime);

  return await executeNonSandbox(code, ctx, frame, env, runtime);
};

export { execute };
export type { ExecuteConfig };
