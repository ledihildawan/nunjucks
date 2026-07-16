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
} from '../runtime/index.js';

const getRenderFunction = (code) => {
  const newFormatMatch = code.match(/^async\s+function\s+root\s*\(/);
  if (newFormatMatch) {
    const codeWithReturn = code + '; return root;';
    const renderFn = new Function(codeWithReturn);
    const result = renderFn();
    return { render: result.root };
  }
  
  throw new Error('Unrecognized code format: expected "async function root"');
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

  // Dev warning for unsandboxed rendering
  if (!sandbox && devWarningSandbox) {
    console.warn(
      `[Nunjucks] WARNING: Rendering template without sandbox enabled. ` +
      `For user-provided templates, enable sandbox: { sandbox: true } to prevent security issues.`
    );
  }

  const getFilter = (name) => {
    const filterFn = filters[name];
    if (filterFn) return filterFn;
    const ctxFn = context[name] && typeof context[name] === 'function' ? context[name] : null;
    if (ctxFn) return ctxFn;
    throw new Error(`Filter "${name}" not found`);
  };

  // Create runtime object for the new format
  const warningsCollector = config.warningsCollector || [];
  const logContext = {
    templateName: config.templateName || 'inline',
    phase: 'render'
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
      }
    };
  }

  // Create a minimal frame object with lookup method (used by contextOrFrameLookup)
  const emptyFrame = {
    lookup: () => undefined
  };

  // Handle sandbox mode
  if (sandbox) {
    const safeContext = new Proxy(ctx, {
      get(target, key) {
        if (key === '__proto__' || key === 'constructor') return undefined;
        return target[key];
      },
      set() {
        throw new Error('Cannot modify sandboxed context');
      }
    });
    
    const safeRuntime = { ...runtime };
    
    // Create env object for new format with getFilter
    const env = {
      opts: {
        autoescape: config.autoescape ?? true,
        undefined: config.undefined ?? 'default'
      },
      getFilter: (name) => {
        const filterFn = filters[name];
        if (filterFn) return filterFn;
        throw new Error(`Filter "${name}" not found`);
      }
    };
    
    // Execute code - support both old and new format
    const { render } = getRenderFunction(code);
    
    return await render(env, safeContext, emptyFrame, safeRuntime);
  }

  // Execute code - support both old and new format
  const { render } = getRenderFunction(code);
  
  // Create env object for new format (matches new compiler expectations)
  const env = {
    opts: {
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default'
    },
    getFilter: (name) => {
      const filterFn = filters[name];
      if (filterFn) return filterFn;
      throw new Error(`Filter "${name}" not found`);
    }
  };
  
  return await render(env, ctx, emptyFrame, runtime);
};
