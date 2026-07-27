import {
  suppressValue, awaitValue, handleError, contextOrFrameLookup,
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
  inOperator, fromIterator, callWrap,
  ensureDefined, isSafeString, markSafe, copySafeness,
  lookup,
  createContext,
  type ContextEnv,
  type BlockLocation,
  createFrame, type Frame,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  makeMacro,
  createSafeString,
  createSandboxedContext,
  wrapMemberAccess,
} from '@nunjucks/runtime';
import { getError } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import { extractBlocks } from '@nunjucks/shared';

interface UndefinedInputResult {
  isUndefinedInput: boolean;
  undefinedVarName: string | null;
  undefinedParentName: string | null;
  isPropertyLookup: boolean;
}

// `inputValue` is declared `unknown`, not `string`: the body deliberately
// handles null and non-string inputs, and typing it as `string` made those
// guards look dead while they are the function's actual contract.
const detectNullInput = (_inputValue: unknown): UndefinedInputResult => ({
  isUndefinedInput: true,
  undefinedVarName: '<null>',
  undefinedParentName: null,
  isPropertyLookup: false,
});

const detectNonStringInput = (): UndefinedInputResult => ({
  isUndefinedInput: false,
  undefinedVarName: null,
  undefinedParentName: null,
  isPropertyLookup: false,
});

const isUndefinedOrNull = (val: unknown): boolean => val === undefined || val === null;

const findUndefinedAt = (context: unknown, parts: string[]): number => {
  let val: unknown = context;
  for (let i = 0; i < parts.length; i += 1) {
    if (isUndefinedOrNull(val)) {
      return i;
    }
    try {
      val = (val as Record<string, unknown>)[parts[i] ?? ''];
    } catch (e) {
      if (e instanceof TypeError) {
        return i;
      }
      throw e;
    }
  }
  return isUndefinedOrNull(val) ? parts.length - 1 : -1;
};

const detectUndefinedInput = (context: unknown, inputValue: unknown): UndefinedInputResult => {
  if (inputValue === null) {
    return detectNullInput(inputValue);
  }

  if (typeof inputValue !== 'string') {
    return detectNonStringInput();
  }

  const parts = inputValue.split('.');
  const isPropertyLookup = parts.length > 1;

  try {
    const undefinedAt = findUndefinedAt(context, parts);
    if (undefinedAt >= 0) {
      return {
        isUndefinedInput: true,
        undefinedVarName: parts.slice(undefinedAt).join('.'),
        undefinedParentName: undefinedAt > 0 ? parts[undefinedAt - 1] ?? null : null,
        isPropertyLookup,
      };
    }
  } catch (e) {
    if (e instanceof TypeError) {
      return {
        isUndefinedInput: true,
        undefinedVarName: inputValue,
        undefinedParentName: null,
        isPropertyLookup,
      };
    }
    throw e;
  }

  return {
    isUndefinedInput: false,
    undefinedVarName: null,
    undefinedParentName: null,
    isPropertyLookup,
  };
};

interface GetFilterConfig {
  env?: { getFilter: (name: string, lineno: number | null, colno: number | null) => unknown };
}

type FilterFunction = (...args: unknown[]) => unknown;

const lookupFilter = (
  name: string,
  filters: Record<string, FilterFunction>,
  context: Record<string, unknown>,
  config: GetFilterConfig
): FilterFunction | undefined => {
  const filterFn = filters[name];
  if (filterFn) { return filterFn; }

  let ctxFn: FilterFunction | null = null;
  if (context[name] && typeof context[name] === 'function') {
    ctxFn = context[name] as FilterFunction;
  }
  if (ctxFn) { return ctxFn; }

  if (config.env?.getFilter) {
    const envFilter = config.env.getFilter(name, null, null);
    if (envFilter) { return envFilter as FilterFunction; }
  }

  return undefined;
};

const getErrorLocation = (
  inputLineno: number | undefined,
  inputColno: number | undefined,
  filterLineno: number | null,
  filterColno: number | null
): { lineno: number | null; colno: number | null } => {
  const useInputLocation = inputLineno !== undefined && inputColno !== undefined;
  return {
    lineno: useInputLocation ? inputLineno ?? null : filterLineno,
    colno: useInputLocation ? inputColno ?? null : filterColno,
  };
};

const throwUndefinedPropertyError = (
  undefinedVarName: string | null,
  undefinedParentName: string,
  lineno: number | null,
  colno: number | null
): never => {
  throw createLog('error', getError('UNDEFINED_PROPERTY'), { property: undefinedVarName ?? '', parent: undefinedParentName }, undefinedVarName ?? undefined, { lineno, colno, phase: 'render', lineBase: 'zero' });
};

const throwUndefinedVariableError = (
  undefinedVarName: string | null,
  inputValue: unknown,
  lineno: number | null,
  colno: number | null
): never => {
  throw createLog('error', getError('UNDEFINED_VARIABLE'), { name: undefinedVarName ?? (inputValue as string) }, undefinedVarName ?? (inputValue as string), { lineno, colno, phase: 'render', lineBase: 'zero' });
};

const createUndefinedFilterError = (
  name: string,
  inputValue: unknown,
  strictPipeInput: boolean,
  inputLineno: number | undefined,
  inputColno: number | undefined,
  filterLineno: number | null,
  filterColno: number | null,
  context: Record<string, unknown>
): never => {
  const { lineno, colno } = getErrorLocation(inputLineno, inputColno, filterLineno, filterColno);

  if (inputValue !== undefined) {
    const { isUndefinedInput, undefinedVarName, undefinedParentName, isPropertyLookup } = detectUndefinedInput(context, inputValue as string);

    if (isUndefinedInput || strictPipeInput) {
      if (isPropertyLookup && undefinedParentName) {
        throwUndefinedPropertyError(undefinedVarName, undefinedParentName, lineno, colno);
      }
      throwUndefinedVariableError(undefinedVarName, inputValue, lineno, colno);
    }
  }

  throw createLog('error', getError('UNDEFINED_FILTER'), { name }, name, { lineno: filterLineno ?? null, colno: filterColno ?? null, phase: 'render', lineBase: 'zero' });
};

const createGetFilter = (
  context: Record<string, unknown>,
  filters: Record<string, FilterFunction>,
  config: GetFilterConfig,
  strictPipeInput: boolean
) => function getFilter(
    name: string,
    filterLineno: number | null,
    filterColno: number | null,
    inputLineno: number | undefined,
    inputColno: number | undefined,
    inputValue: unknown
  ): FilterFunction | undefined {
    const filter = lookupFilter(name, filters, context, config);
    if (filter) { return filter; }
    throw createUndefinedFilterError(name, inputValue, strictPipeInput, inputLineno, inputColno, filterLineno, filterColno, context);
  };

const ROOT_FUNCTION_RE = /^async\s+function\s+root\s*\(/;

interface RenderFunctionResult {
  render: (env: unknown, context: unknown, frame: Frame, runtime: unknown) => Promise<unknown>;
  blocks: Record<string, unknown>;
  blockMeta: Record<string, unknown>;
}

const getRenderFunction = (code: string): RenderFunctionResult => {
  const newFormatMatch = code.match(ROOT_FUNCTION_RE);
  if (newFormatMatch) {
    const codeWithReturn = `${code}; return root;`;
    const renderFn = new Function(codeWithReturn)();
    const result = renderFn as { root: RenderFunctionResult['render']; __blockMeta?: Record<string, unknown> };
    const blocks = extractBlocks(result);
    return { render: result.root, blocks, blockMeta: result.__blockMeta || {} };
  }

  throw createLog('error', getError('INVALID_CODE_FORMAT'), {}, null, { phase: 'compile' });
};

const getRuntimeHelpers = () => ({
  suppressValue,
  awaitValue,
  handleError,
  contextOrFrameLookup,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  inOperator,
  fromIterator,
  callWrap,
  ensureDefined,
  isSafeString,
  markSafe,
  copySafeness,
  lookup,
  createFrame,
  createSafeString,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  makeMacro,
  escape: (str: unknown, autoescape = true): string => {
    if (!autoescape) { return String(str); }
    if (str && typeof str === 'object' && isSafeString(str as { val?: unknown })) { return String((str as { val: unknown }).val); }
    if (Array.isArray(str)) { return str.join(','); }
    if (str && typeof str === 'object') { return JSON.stringify(str); }
    return String(str).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] as string));
  },
});

type Environment = 'auto' | 'node' | 'browser' | 'deno';

interface SandboxOptions {
  allowlist?: string[];
  blocklistMode?: boolean;
  environment?: Environment;
}

const buildSandboxOptions = (config: { sandboxAllowlist?: string[]; sandboxMode?: string; sandboxEnvironment?: string }): SandboxOptions => ({
  allowlist: config.sandboxAllowlist || [],
  blocklistMode: config.sandboxMode !== 'allowlist',
  environment: (config.sandboxEnvironment || 'auto') as Environment,
});

const buildSandboxedRuntime = (runtime: Record<string, unknown>, sandboxOptions: SandboxOptions): Record<string, unknown> => {
  runtime.memberLookup = (obj: unknown, val: string | symbol, parentName: string | null = null) => wrapMemberAccess(obj, val, true, sandboxOptions, parentName);
  runtime.optionalMemberLookup = (obj: unknown, val: string | symbol, parentName: string | null = null) => wrapMemberAccess(obj, val, true, sandboxOptions, parentName);
  return runtime;
};

interface BuildEnvObjectConfig {
  dev?: boolean;
  autoescape?: boolean;
  undefined?: string;
  env?: { opts?: Record<string, unknown>; getFilter?: (name: string, lineno: number | null, colno: number | null) => unknown; getTest?: (name: string, lineno: number | null, colno: number | null) => unknown; getTemplate?: unknown };
}

const buildEnvObject = (config: BuildEnvObjectConfig, getFilter: ReturnType<typeof createGetFilter>, getTest: (name: string, lineno: number | null, colno: number | null) => unknown) => {
  const envObj: Record<string, unknown> = {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
      ...(config.env?.opts || {})
    },
    getFilter,
    getTest,
  };
  if (config.env?.getTemplate) {
    envObj.getTemplate = config.env.getTemplate;
  }
  return envObj;
};

export interface ExecuteConfig {
  sandbox?: boolean;
  devWarningSandbox?: boolean;
  globals?: Record<string, unknown>;
  filters?: Record<string, FilterFunction>;
  tests?: Record<string, (value: unknown) => boolean>;
  env?: unknown;
  templateName?: string;
  renderContext?: unknown;
  sandboxAllowlist?: string[];
  sandboxMode?: string;
  sandboxEnvironment?: string;
  strictPipeInput?: boolean;
  warningsCollector?: unknown[];
  autoescape?: boolean;
}

export const execute = async (code: string, context: Record<string, unknown> = {}, config: ExecuteConfig = {}): Promise<unknown> => {
  const sandbox = config.sandbox ?? false;
  const devWarningSandbox = config.devWarningSandbox ?? true;
  const globals = config.globals ?? {};
  const filters = config.filters ?? {};
  const tests = config.tests ?? {};

  const getTest = (name: string, lineno: number | null, colno: number | null) => {
    const testFn = tests[name];
    if (testFn) { return testFn; }
    const envWithTest = config.env as { getTest?: (name: string, lineno: number | null, colno: number | null) => unknown } | undefined;
    if (envWithTest?.getTest) { return envWithTest.getTest(name, lineno, colno); }
    throw createLog('error', getError('UNDEFINED_TEST'), { name }, name, { lineno: lineno ?? null, colno: colno ?? null, phase: 'render', lineBase: 'zero' });
  };

  if (!sandbox && devWarningSandbox) {
    // biome-ignore lint/suspicious/noConsole: documented fallback when no warning collector is attached to the render.
    console.warn(
      '[Nunjucks] WARNING: Rendering template without sandbox enabled. ' +
      'For user-provided templates, enable sandbox: { sandbox: true } to prevent security issues.'
    );
  }

  const strictPipeInput = config.strictPipeInput ?? false;
  const getFilter = createGetFilter(context, filters, { env: config.env as GetFilterConfig['env'] }, strictPipeInput);

  const warningsCollector = config.warningsCollector || [];
  const logContext = {
    templateName: config.templateName || 'inline',
    phase: 'render',
    renderContext: config.renderContext
  };
  const runtime: Record<string, unknown> = {
    ...globals,
    ...filters,
    ...getRuntimeHelpers(),
    getFilter,
    __warnings__: warningsCollector,
    logContext,
  };

  if (config.sandbox) {
    buildSandboxedRuntime(runtime, buildSandboxOptions(config));
  }

  if (config.env) {
    runtime.env = config.env;
  }

  const ctx = buildContextObject(context, config, runtime);

  const frame = createFrame();
  const env = buildEnvObject(config as BuildEnvObjectConfig, getFilter, getTest);

  if (sandbox) {
    const safeContext = createSandboxedContext(ctx, true, buildSandboxOptions(config));
    const safeRuntime = { ...runtime };
    const { render } = getRenderFunction(code);
    return await render(env, safeContext, frame, safeRuntime);
  }

  return await executeNonSandbox(code, ctx, frame, env, runtime);
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
