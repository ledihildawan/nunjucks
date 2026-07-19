import { 
  suppressValue, awaitValue, handleError, contextOrFrameLookup,
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
  inOperator, fromIterator, callWrap,
  ensureDefined, isSafeString, markSafe, copySafeness,
  lookup,
  createContext,
  createFrame,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  makeMacro,
  createSafeString,
  createSandboxedContext,
  wrapMemberAccess,
} from '../runtime/index.js';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';

function createGetFilter(context, filters, config, strictPipeInput) {
  return function getFilter(name, filterLineno, filterColno, inputLineno, inputColno, inputValue) {
    const filterFn = filters[name];
    if (filterFn) return filterFn;

    const ctxFn = context[name] && typeof context[name] === 'function' ? context[name] : null;
    if (ctxFn) return ctxFn;

    if (config.env?.getFilter) {
      const envFilter = config.env.getFilter(name, filterLineno, filterColno);
      if (envFilter) return envFilter;
    }

    const useInputLocation = inputLineno !== undefined && inputColno !== undefined;
    const errorLineno = useInputLocation ? inputLineno : filterLineno;
    const errorColno = useInputLocation ? inputColno : filterColno;

    if (inputValue !== undefined) {
      let isUndefinedInput = false;
      let undefinedVarName = null;
      let undefinedParentName = null;
      let isPropertyLookup = false;

      if (inputValue === null) {
        isUndefinedInput = true;
        undefinedVarName = '<null>';
      } else if (typeof inputValue === 'string' && inputValue.includes('.')) {
        isPropertyLookup = true;
        const parts = inputValue.split('.');
        try {
          let val = context;
          for (let i = 0; i < parts.length; i++) {
            if (val === undefined || val === null) {
              isUndefinedInput = true;
              undefinedVarName = parts.slice(i).join('.');
              undefinedParentName = i > 0 ? parts[i - 1] : null;
              break;
            }
            val = val[parts[i]];
          }
          if (!isUndefinedInput && (val === undefined || val === null)) {
            isUndefinedInput = true;
            undefinedVarName = parts[parts.length - 1];
            undefinedParentName = parts.length > 1 ? parts[parts.length - 2] : null;
          }
        } catch (e) {
          isUndefinedInput = true;
          undefinedVarName = inputValue;
        }
      } else if (typeof inputValue === 'string') {
        try {
          if (context[inputValue] === undefined) {
            isUndefinedInput = true;
            undefinedVarName = inputValue;
          }
        } catch (e) {
          isUndefinedInput = true;
          undefinedVarName = inputValue;
        }
      }

      if (isUndefinedInput || strictPipeInput) {
        if (isPropertyLookup && undefinedParentName) {
          throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_PROPERTY, { property: undefinedVarName, parent: undefinedParentName }, undefinedVarName, { lineno: errorLineno ?? null, colno: errorColno ?? null, phase: 'render', lineBase: 'zero' });
        }
        throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_VARIABLE, { name: undefinedVarName ?? inputValue }, undefinedVarName ?? inputValue, { lineno: errorLineno ?? null, colno: errorColno ?? null, phase: 'render', lineBase: 'zero' });
      }
    }

    throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_FILTER, { name }, name, { lineno: filterLineno ?? null, colno: filterColno ?? null, phase: 'render', lineBase: 'zero' });
  };
}

const getRenderFunction = (code) => {
  const newFormatMatch = code.match(/^async\s+function\s+root\s*\(/);
  if (newFormatMatch) {
    const codeWithReturn = code + '; return root;';
    const renderFn = new Function(codeWithReturn);
    const result = renderFn();
    const blocks = {};
    Object.keys(result).forEach((key) => {
      if (key.startsWith('b_')) {
        blocks[key.slice(2)] = result[key];
      }
    });
    return { render: result.root, blocks, blockMeta: result.__blockMeta || {} };
  }
  
  throw createLog('error', ERROR_DEFINITIONS.INVALID_CODE_FORMAT, {}, null, { phase: 'compile' });
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
  escape: (str, autoescape = true) => {
    if (!autoescape) return str;
    if (str && typeof str === 'object' && isSafeString(str)) return str.val;
    if (Array.isArray(str)) return str.join(',');
    if (str && typeof str === 'object') return JSON.stringify(str);
    return String(str).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  },
});

export const execute = async (code, context = {}, config = {}) => {
  const sandbox = config.sandbox ?? false;
  const devWarningSandbox = config.devWarningSandbox ?? true;
  const globals = config.globals ?? {};
  const filters = config.filters ?? {};
  const tests = config.tests ?? {};

  const getTest = (name, lineno, colno) => {
    const testFn = tests[name];
    if (testFn) return testFn;
    if (config.env?.getTest) return config.env.getTest(name, lineno, colno);
    throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_TEST, { name }, name, { lineno: lineno ?? null, colno: colno ?? null, phase: 'render', lineBase: 'zero' });
  };

  // Dev warning for unsandboxed rendering
  if (!sandbox && devWarningSandbox) {
    console.warn(
      `[Nunjucks] WARNING: Rendering template without sandbox enabled. ` +
      `For user-provided templates, enable sandbox: { sandbox: true } to prevent security issues.`
    );
  }

  const strictPipeInput = config.strictPipeInput ?? false;
  const getFilter = createGetFilter(context, filters, config, strictPipeInput);

  // Create runtime object for the new format
  const warningsCollector = config.warningsCollector || [];
  const logContext = {
    templateName: config.templateName || 'inline',
    phase: 'render',
    renderContext: config.renderContext
  };
  const runtime = { 
    ...globals, 
    ...filters, 
    ...getRuntimeHelpers(),
    getFilter,
    __warnings__: warningsCollector,
    logContext,
    sourceMapData: config.sourceMapData || null
  };

  if (config.sandbox) {
    const sandboxOptions = {
      allowlist: config.sandboxAllowlist || [],
      blocklistMode: config.sandboxMode !== 'allowlist',
      environment: config.sandboxEnvironment || 'auto'
    };
    runtime.memberLookup = (obj, val) => wrapMemberAccess(obj, val, true, sandboxOptions);
    runtime.optionalMemberLookup = (obj, val) => obj == null ? undefined : wrapMemberAccess(obj, val, true, sandboxOptions);
  }

  if (config.env) {
    runtime.env = config.env;
  }
  
  let ctx;
  if (config.env) {
    ctx = createContext(context, {}, config.env);
    ctx._autoescape = config.autoescape ?? true;
  } else {
    const exported = [];
    ctx = {
      ...context,
      _autoescape: config.autoescape ?? true,
      lookup: function(key) {
        if (key in ctx) {
          return ctx[key];
        }
        if (key in runtime) {
          return runtime[key];
        }
        return undefined;
      },
      setVariable: function(name, val) {
        ctx[name] = val;
      },
      addExport: function(name) {
        exported.push(name);
      },
      getExported: function() {
        const result = {};
        exported.forEach((name) => {
          result[name] = ctx[name];
        });
        return result;
      },
      getSuper: function(envObj, name, block, frame, lineno = null, colno = null) {
        throw createLog('error', ERROR_DEFINITIONS.NO_SUPER_BLOCK, { name }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
      }
    };
  }

  // Create a proper frame object
  const frame = createFrame();

  // Handle sandbox mode
  if (sandbox) {
    const safeContext = createSandboxedContext(ctx, true, {
      allowlist: config.sandboxAllowlist || [],
      blocklistMode: config.sandboxMode !== 'allowlist',
      environment: config.sandboxEnvironment || 'auto'
    });
    
    const safeRuntime = { ...runtime };
    
    // Create env object for new format with getFilter
    const env = {
      opts: {
        dev: config.dev ?? false,
        autoescape: config.autoescape ?? true,
        undefined: config.undefined ?? 'default',
        ...(config.env?.opts || {})
      },
      getFilter: createGetFilter(context, filters, config, strictPipeInput),
      getTest,
      ...(config.env ? { getTemplate: (...args) => config.env.getTemplate(...args) } : {})
    };
    
    // Execute code - support both old and new format
    const { render } = getRenderFunction(code);
    
    return await render(env, safeContext, frame, safeRuntime);
  }

  // Execute code - support both old and new format
  const { render, blocks, blockMeta } = getRenderFunction(code);
  
  // Create env object for new format (matches new compiler expectations)
  const env = {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
      ...(config.env?.opts || {})
    },
    getFilter: createGetFilter(context, filters, config, strictPipeInput),
    getTest,
    ...(config.env ? { getTemplate: (...args) => config.env.getTemplate(...args) } : {})
  };
  
  if (config.env) {
    ctx = createContext(context, blocks, config.env, { blockLocations: blockMeta });
    ctx._autoescape = config.autoescape ?? true;
  } else {
    ctx.blocks = blocks;
    ctx.getBlock = function(name) {
      if (!blocks[name]) {
        throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_BLOCK, { name }, name, { phase: 'render' });
      }
      return blocks[name];
    };
  }

  return await render(env, ctx, frame, runtime);
};
