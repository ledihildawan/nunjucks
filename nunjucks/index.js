import * as lib from './src/lib/index.js';
import { Environment, Template } from './src/environment.js';
import Loader from './src/loaders/base-loader.js';
import * as loaders from './src/loaders/index.js';
import * as compiler from './src/compiler.js';
import * as parser from './src/parser.js';
import * as lexer from './src/lexer.js';
import * as runtime from './src/runtime.js';
import * as nodes from './src/nodes.js';
import installJinjaCompat from './src/jinja-compat.js';
import * as precompile from './src/precompile.js';
import { setErrorConfig } from './src/error/config.js';

let _env = null;

const createLoader = (loaderMod, templatesPath, opts) => {
  if (loaderMod.FileSystemLoader) {
    return new loaderMod.FileSystemLoader(templatesPath, {
      watch: opts.watch,
      noCache: opts.noCache
    });
  }
  if (loaderMod.WebLoader) {
    return new loaderMod.WebLoader(templatesPath, {
      useCache: opts.web?.useCache,
      async: opts.web?.async
    });
  }
  return null;
};

const applyExpress = (env, opts) => {
  if (opts?.express) {
    env.express(opts.express);
  }
};

const normalizeOpts = (templatesPath, opts) => {
  opts = opts || {};
  if (lib.isObject(templatesPath)) {
    return { opts: templatesPath, templatesPath: null };
  }
  if (opts.mode === 'development') {
    opts.watch = opts.watch !== false;
  }
  return { opts, templatesPath };
};

export const configure = (templatesPath, opts) => {
  const { opts: normalizedOpts, templatesPath: normalizedPath } = normalizeOpts(templatesPath, opts);
  setErrorConfig(normalizedOpts);
  const loader = createLoader(loaders, normalizedPath, normalizedOpts);
  _env = new Environment(loader, normalizedOpts);
  applyExpress(_env, normalizedOpts);
  return _env;
};

export const reset = () => {
  _env = null;
};

const getEnv = () => {
  if (!_env) {
    configure();
  }
  return _env;
};

export const compile = (src, env, path, eagerCompile) => new Template(src, env, path, eagerCompile);

export const render = (name, ctx) => getEnv().render(name, ctx);

export const renderString = (src, ctx) => getEnv().renderString(src, ctx);

export { Environment, Template };
export { Loader };
export { FileSystemLoader } from './src/loaders/node/index.js';
export { NodeResolveLoader } from './src/loaders/node/index.js';
export { PrecompiledLoader } from './src/loaders/precompiled-loader.js';
export { WebLoader } from './src/loaders/web/index.js';
export { compiler, parser, lexer, runtime, lib, nodes, installJinjaCompat };
export { precompile, precompileString } from './src/precompile.js';
export { getConfig, renderError, renderErrorString, Environment as ErrorEnvironment } from './src/error/index.js';

export default {
  Environment,
  Template,
  Loader,
  FileSystemLoader: loaders.FileSystemLoader,
  NodeResolveLoader: loaders.NodeResolveLoader,
  PrecompiledLoader: loaders.PrecompiledLoader,
  WebLoader: loaders.WebLoader,
  compiler,
  parser,
  lexer,
  runtime,
  lib,
  nodes,
  installJinjaCompat,
  configure,
  reset,
  compile,
  render,
  renderString,
  precompile: precompile.precompile,
  precompileString: precompile.precompileString
};
