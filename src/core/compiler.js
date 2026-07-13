import { compile as _compile } from '../compiler/index.js';
import { 
  suppressValue, awaitValue, handleError, contextOrFrameLookup,
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
  inOperator, fromIterator, callWrap,
  ensureDefined, isSafeString, markSafe, copySafeness,
  createFrame
} from '../runtime/index.js';
import { createContext } from '../runtime/context.js';
import { pipe, filter, isDefined, reduce } from 'remeda';

export const compile = (template, config = {}) => {
  const opts = {
    autoescape: config.autoescape ?? true,
    trimBlocks: config.trimBlocks ?? false,
    lstripBlocks: config.lstripBlocks ?? false,
    undefined: config.undefined ?? 'default',
  };

  const extensions = Object.values(config.extensions || {});

  const processedSrc = pipe(
    extensions,
    exts => exts.map(ext => ext.preprocess),
    comps => filter(comps, isDefined),
    processors => reduce(processors, (s, processor) => processor(s), template)
  );

  const code = _compile(
    processedSrc,
    [],
    extensions,
    config.name || 'template',
    opts
  );

  return code;
};

export const compileWithSourceMap = (template, config = {}) => {
  const code = compile(template, { ...config, name: config.name || 'template' });
  return { code };
};

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

  const env = { 
    opts: { autoescape: config.autoescape ?? true }, 
    globals,
    getFilter,
    opts: config
  };
  const runtime = { ...globals, ...filters, ...getRuntimeHelpers() };
  const frame = createFrame();

  const ctx = createContext(context, {}, env);
  const templateFn = new Function(code)();
  const rootFn = templateFn.root;

  if (sandbox) {
    const safeContext = createSandboxedObject(ctx, true);
    const safeGlobals = createSandboxedObject(globals, true);
    const safeRuntime = { ...safeGlobals, ...getRuntimeHelpers() };
    return await rootFn(env, safeContext, frame, safeRuntime);
  }

  return await rootFn(env, ctx, frame, runtime);
};

const executeSandboxed = (code, context, config, env, runtime, frame) => {
  const safeContext = createSandboxedObject(context, true);
  const safeGlobals = createSandboxedObject(config.globals || {}, true);
  const safeRuntime = { ...safeGlobals, ...getRuntimeHelpers() };

  const renderFn = new Function('env', 'context', 'frame', 'runtime', code);
  return renderFn(env, safeContext, frame, safeRuntime);
};

const createSandboxedObject = (obj, enabled) => {
  if (!enabled || !obj || typeof obj !== 'object') {
    return obj;
  }

  return new Proxy(obj, {
    get(target, key) {
      if (key === '__proto__' || key === 'constructor') {
        return undefined;
      }
      return target[key];
    },
    set() {
      if (enabled) {
        throw new Error('Cannot modify sandboxed object');
      }
      return true;
    }
  });
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
  escape: (str) => String(str).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char])),
});
