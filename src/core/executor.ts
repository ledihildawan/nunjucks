import {
  suppressValue, awaitValue, handleError, contextOrFrameLookup,
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
  inOperator, fromIterator, callWrap,
  ensureDefined, isSafeString, markSafe, copySafeness,
  lookup,
  createContext,
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
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import { extractBlocks } from './env.js';

interface UndefinedInputResult {
  isUndefinedInput: boolean;
  undefinedVarName: string | null;
  undefinedParentName: string | null;
  isPropertyLookup: boolean;
}

const detectUndefinedInput = (context: unknown, inputValue: string): UndefinedInputResult => {
  let isUndefinedInput = false;
  let undefinedVarName: string | null = null;
  let undefinedParentName: string | null = null;
  let isPropertyLookup = false;

  if (inputValue === null) {
    isUndefinedInput = true;
    undefinedVarName = '<null>';
  } else if (typeof inputValue === 'string' && inputValue.includes('.')) {
    isPropertyLookup = true;
    const parts = inputValue.split('.');
    try {
      let val: unknown = context;
      for (let i = 0; i < parts.length; i++) {
        if (val === undefined || val === null) {
          isUndefinedInput = true;
          undefinedVarName = parts.slice(i).join('.');
          undefinedParentName = i > 0 ? parts[i - 1]! : null;
          break;
        }
        val = (val as Record<string, unknown>)[parts[i]!];
      }
      if (!isUndefinedInput && (val === undefined || val === null)) {
        isUndefinedInput = true;
        undefinedVarName = parts[parts.length - 1]!;
        undefinedParentName = parts.length > 1 ? parts[parts.length - 2]! : null;
      }
    } catch (e) {
      if (e instanceof TypeError) {
        isUndefinedInput = true;
        undefinedVarName = inputValue;
      } else {
        throw e;
      }
    }
  } else if (typeof inputValue === 'string') {
    try {
      if ((context as Record<string, unknown>)[inputValue] === undefined) {
        isUndefinedInput = true;
        undefinedVarName = inputValue;
      }
    } catch (e) {
      if (e instanceof TypeError) {
        isUndefinedInput = true;
        undefinedVarName = inputValue;
      } else {
        throw e;
      }
    }
  }

  return { isUndefinedInput, undefinedVarName, undefinedParentName, isPropertyLookup };
};

interface GetFilterConfig {
  env?: { getFilter: (name: string, lineno: number | null, colno: number | null) => unknown };
}

type FilterFunction = (...args: unknown[]) => unknown;

const createGetFilter = (
  context: Record<string, unknown>,
  filters: Record<string, FilterFunction>,
  config: GetFilterConfig,
  strictPipeInput: boolean
) => {
  return function getFilter(
    name: string,
    filterLineno: number | null,
    filterColno: number | null,
    inputLineno: number | undefined,
    inputColno: number | undefined,
    inputValue: unknown
  ): FilterFunction | undefined {
    const filterFn = filters[name];
    if (filterFn) return filterFn;

    const ctxFn = context[name] && typeof context[name] === 'function' ? context[name] as FilterFunction : null;
    if (ctxFn) return ctxFn;

    if (config.env?.getFilter) {
      const envFilter = config.env.getFilter(name, filterLineno, filterColno);
      if (envFilter) return envFilter as FilterFunction;
    }

    const useInputLocation = inputLineno !== undefined && inputColno !== undefined;
    const errorLineno = useInputLocation ? inputLineno : filterLineno;
    const errorColno = useInputLocation ? inputColno : filterColno;

    if (inputValue !== undefined) {
      const { isUndefinedInput, undefinedVarName, undefinedParentName, isPropertyLookup } = detectUndefinedInput(context, inputValue as string);

      if (isUndefinedInput || strictPipeInput) {
        if (isPropertyLookup && undefinedParentName) {
          throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_PROPERTY!, { property: undefinedVarName ?? '', parent: undefinedParentName }, undefinedVarName ?? undefined, { lineno: errorLineno ?? null, colno: errorColno ?? null, phase: 'render', lineBase: 'zero' });
        }
        throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_VARIABLE!, { name: undefinedVarName ?? (inputValue as string) }, undefinedVarName ?? (inputValue as string), { lineno: errorLineno ?? null, colno: errorColno ?? null, phase: 'render', lineBase: 'zero' });
      }
    }

    throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_FILTER!, { name }, name, { lineno: filterLineno ?? null, colno: filterColno ?? null, phase: 'render', lineBase: 'zero' });
  };
};

interface RenderFunctionResult {
  render: (env: unknown, context: unknown, frame: Frame, runtime: unknown) => Promise<unknown>;
  blocks: Record<string, unknown>;
  blockMeta: Record<string, unknown>;
}

const getRenderFunction = (code: string): RenderFunctionResult => {
  const newFormatMatch = code.match(/^async\s+function\s+root\s*\(/);
  if (newFormatMatch) {
    const codeWithReturn = code + '; return root;';
    const renderFn = new Function(codeWithReturn)();
    const result = renderFn as { root: RenderFunctionResult['render']; __blockMeta?: Record<string, unknown> };
    const blocks = extractBlocks(result);
    return { render: result.root, blocks, blockMeta: result.__blockMeta || {} };
  }

  throw createLog('error', ERROR_DEFINITIONS.INVALID_CODE_FORMAT!, {}, null, { phase: 'compile' });
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
    if (!autoescape) return String(str);
    if (str && typeof str === 'object' && isSafeString(str as { val?: unknown })) return String((str as { val: unknown }).val);
    if (Array.isArray(str)) return str.join(',');
    if (str && typeof str === 'object') return JSON.stringify(str);
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

const buildEnvObject = (config: BuildEnvObjectConfig, getFilter: ReturnType<typeof createGetFilter>, getTest: (name: string, lineno: number | null, colno: number | null) => unknown) => ({
  opts: {
    dev: config.dev ?? false,
    autoescape: config.autoescape ?? true,
    undefined: config.undefined ?? 'default',
    ...(config.env?.opts || {})
  },
  getFilter,
  getTest,
  ...(config.env?.getTemplate ? { getTemplate: config.env.getTemplate } : {})
});

export interface ExecuteConfig {
  sandbox?: boolean;
  devWarningSandbox?: boolean;
  globals?: Record<string, unknown>;
  filters?: Record<string, FilterFunction>;
  tests?: Record<string, (value: unknown) => boolean>;
  env?: unknown;
  templateName?: string;
  renderContext?: unknown;
  sourceMapData?: unknown[] | null;
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
    if (testFn) return testFn;
    const envWithTest = config.env as { getTest?: (name: string, lineno: number | null, colno: number | null) => unknown } | undefined;
    if (envWithTest?.getTest) return envWithTest.getTest(name, lineno, colno);
    throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_TEST!, { name }, name, { lineno: lineno ?? null, colno: colno ?? null, phase: 'render', lineBase: 'zero' });
  };

  if (!sandbox && devWarningSandbox) {
    console.warn(
      `[Nunjucks] WARNING: Rendering template without sandbox enabled. ` +
      `For user-provided templates, enable sandbox: { sandbox: true } to prevent security issues.`
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
    sourceMapData: config.sourceMapData || null
  };

  if (config.sandbox) {
    buildSandboxedRuntime(runtime, buildSandboxOptions(config));
  }

  if (config.env) {
    runtime.env = config.env;
  }

  let ctx: Record<string, unknown>;
  if (config.env) {
    ctx = createContext(context, {}, config.env as Parameters<typeof createContext>[2]) as unknown as Record<string, unknown>;
    ctx._autoescape = config.autoescape ?? true;
  } else {
    const exported: string[] = [];
    ctx = {
      ...context,
      _autoescape: config.autoescape ?? true,
      lookup: function(key: string) {
        if (key in ctx) {
          return ctx[key];
        }
        if (key in runtime) {
          return runtime[key];
        }
        return undefined;
      },
      setVariable: function(name: string, val: unknown) {
        ctx[name] = val;
      },
      addExport: function(name: string) {
        exported.push(name);
      },
      getExported: function() {
        const result: Record<string, unknown> = {};
        exported.forEach((name) => {
          result[name] = ctx[name];
        });
        return result;
      },
      getSuper: function(_envObj: unknown, name: string, _block: unknown, _frame: Frame, lineno: number | null = null, colno: number | null = null) {
        throw createLog('error', ERROR_DEFINITIONS.NO_SUPER_BLOCK!, { name }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
      }
    };
  }

  const frame = createFrame();

  if (sandbox) {
    const safeContext = createSandboxedContext(ctx, true, buildSandboxOptions(config));
    const safeRuntime = { ...runtime };
    const env = buildEnvObject(config as BuildEnvObjectConfig, getFilter, getTest);

    const { render } = getRenderFunction(code);

    return await render(env, safeContext, frame, safeRuntime);
  }

  const { render, blocks, blockMeta } = getRenderFunction(code);

  const env = buildEnvObject(config as BuildEnvObjectConfig, getFilter, getTest);

  if (config.env) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx = createContext(context, blocks as Record<string, (...args: unknown[]) => unknown>, config.env as any, { blockLocations: blockMeta as any }) as unknown as Record<string, unknown>;
    ctx._autoescape = config.autoescape ?? true;
  } else {
    ctx.blocks = blocks as Record<string, (...args: unknown[]) => unknown>;
    ctx.getBlock = function(name: string) {
      if (!blocks[name]) {
        throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_BLOCK!, { name }, name, { phase: 'render' });
      }
      return blocks[name];
    };
  }

  return await render(env, ctx, frame, runtime);
};
