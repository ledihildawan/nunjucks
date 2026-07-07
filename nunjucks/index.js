import * as lib from './src/lib.js';
import { Environment, Template } from './src/environment.js';
import Loader from './src/loader.js';
import * as loaders from './src/loaders.js';
import * as compiler from './src/compiler.js';
import * as parser from './src/parser.js';
import * as lexer from './src/lexer.js';
import * as runtime from './src/runtime.js';
import * as nodes from './src/nodes.js';
import installJinjaCompat from './src/jinja-compat.js';
import * as precompile from './src/precompile.js';

let e;

export function configure(templatesPath, opts) {
  opts = opts || {};
  if (lib.isObject(templatesPath)) {
    opts = templatesPath;
    templatesPath = null;
  }

  if (opts.mode === 'development') {
    opts.watch = opts.watch !== false;
  }

  let TemplateLoader;

  if (loaders.FileSystemLoader) {
    TemplateLoader = new loaders.FileSystemLoader(templatesPath, {
      watch: opts.watch,
      noCache: opts.noCache
    });
  } else if (loaders.WebLoader) {
    TemplateLoader = new loaders.WebLoader(templatesPath, {
      useCache: opts.web && opts.web.useCache,
      async: opts.web && opts.web.async
    });
  }

  e = new Environment(TemplateLoader, opts);

  if (opts && opts.express) {
    e.express(opts.express);
  }

  return e;
}

export function reset() {
  e = undefined;
}

export function compile(src, env, path, eagerCompile) {
  if (!e) {
    configure();
  }
  return new Template(src, env, path, eagerCompile);
}

export function render(name, ctx) {
  if (!e) {
    configure();
  }

  return e.render(name, ctx);
}

export function renderString(src, ctx) {
  if (!e) {
    configure();
  }

  return e.renderString(src, ctx);
}

export { Environment, Template };
export { Loader };
export { FileSystemLoader } from './src/loaders.js';
export { NodeResolveLoader } from './src/loaders.js';
export { PrecompiledLoader } from './src/loaders.js';
export { WebLoader } from './src/web-loaders.js';
export { createErrorFormatter } from './src/error/index.js';
export { compiler, parser, lexer, runtime, lib, nodes, installJinjaCompat };
export { precompile, precompileString } from './src/precompile.js';

const nunjucks = {
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

export default nunjucks;
