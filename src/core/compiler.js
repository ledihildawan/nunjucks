import { 
  suppressValue, awaitValue, handleError, contextOrFrameLookup,
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
  inOperator, fromIterator, callWrap,
  ensureDefined, isSafeString, markSafe, copySafeness,
  lookup,
  createContext
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
    if (context[name] && typeof context[name] === 'function') return context[name];
    throw new Error(`Filter "${name}" not found`);
  };

  // Create runtime object for the new format
  const runtime = { 
    ...globals, 
    ...filters, 
    ...getRuntimeHelpers(),
    getFilter,
  };

  if (config.env) {
    runtime.env = config.env;
  }
  
  let ctx;
  if (config.env) {
    ctx = createContext(context, {}, config.env);
    ctx._autoescape = config.autoescape ?? true;
  } else {
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
    
    // Create env object for new format
    const env = { opts: { autoescape: config.autoescape ?? true } };
    
    // Execute code - support both old and new format
    const { render } = getRenderFunction(code);
    
    return await render(env, safeContext, emptyFrame, safeRuntime);
  }

  // Execute code - support both old and new format
  const { render } = getRenderFunction(code);
  
  // Create env object for new format (matches new compiler expectations)
  const env = { opts: { autoescape: config.autoescape ?? true } };
  
  return await render(env, ctx, emptyFrame, runtime);
};
