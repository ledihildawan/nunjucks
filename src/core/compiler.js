import { 
  suppressValue, awaitValue, handleError, contextOrFrameLookup,
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
  inOperator, fromIterator, callWrap,
  ensureDefined, isSafeString, markSafe, copySafeness,
  lookup
} from '../runtime/index.js';

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
  escape: (str) => String(str).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char])),
});

export const execute = async (code, context = {}, config = {}) => {
  const sandbox = config.sandbox ?? false;
  const globals = config.globals ?? {};
  const filters = config.filters ?? {};

  const getFilter = (name) => {
    const filterFn = filters[name];
    if (!filterFn) {
      throw new Error(`Filter "${name}" not found`);
    }
    return filterFn;
  };

  // Create runtime object for the new format
  const runtime = { 
    ...globals, 
    ...filters, 
    ...getRuntimeHelpers(),
    getFilter,
  };
  
  // Create simple context with lookup capability
  const ctx = {
    ...context,
    _autoescape: config.autoescape ?? true,
    lookup: function(key) {
      return context[key];
    }
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
    
    // Execute new format code
    const codeAsConst = code.replace(/^export\s+async\s+function\s+render/, 'const render = async function render');
    const fullCode = codeAsConst + '; return render;';
    const renderFn = new Function(fullCode);
    const render = renderFn();
    
    return await render(safeContext, safeRuntime);
  }

  // New format: code starts with "export async function render"
  // Replace "export async function render(...)" with "const render = async function render(...)"
  const codeAsConst = code.replace(/^export\s+async\s+function\s+render/, 'const render = async function render');
  const fullCode = codeAsConst + '; return render;';
  const renderFn = new Function(fullCode);
  const render = renderFn();
  
  return await render(ctx, runtime);
};
