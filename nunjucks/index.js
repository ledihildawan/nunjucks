import { isPlainObject } from 'remeda';
import { Environment, Template } from './src/environment/index.js';
import Loader from './src/loaders/base-loader.js';
import { FileSystemLoader } from './src/loaders/file-system-loader.js';
import { NodeResolveLoader } from './src/loaders/node-resolve-loader.js';
import { WebLoader } from './src/loaders/web-loader.js';
import { PrecompiledLoader } from './src/loaders/precompiled-loader.js';
import {
  Compiler,
  compile as compileSourceToCode,
  getSourceMap,
  getSourceMapFromCompile,
} from './src/compiler.js';
import {
  Parser,
  parse,
} from './src/parser.js';
import {
  Tokenizer,
  lex,
  createToken,
  TOKEN_BLOCK_END,
  TOKEN_BLOCK_START,
  TOKEN_BOOLEAN,
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_FLOAT,
  TOKEN_INT,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
  TOKEN_NONE,
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_REGEX,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_RIGHT_PAREN,
  TOKEN_SPECIAL,
  TOKEN_STRING,
  TOKEN_SYMBOL,
  TOKEN_TILDE,
  TOKEN_TYPES,
  TOKEN_VARIABLE_END,
  TOKEN_VARIABLE_START,
  TOKEN_WHITESPACE,
  WHITESPACE_CHARS,
  DELIM_CHARS,
  INT_CHARS,
  COMPLEX_OPERATORS,
  REGEX_FLAGS,
  createDelimiters,
} from './src/lexer/index.js';
import {
  Frame,
  SafeString,
  copySafeness,
  markSafe,
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  asyncEach,
  asyncAll,
  isArray,
  keys,
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  handleError,
  fromIterator,
  inOperator,
} from './src/runtime/index.js';
import {
  Node,
  NodeList,
  Value,
  Root,
  Literal,
  AstSymbol,
  Group,
  ArrayNode,
  Array,
  Pair,
  Dict,
  LookupVal,
  OptionalChain,
  Slice,
  If,
  IfAsync,
  InlineIf,
  For,
  AsyncEach,
  AsyncAll,
  Macro,
  Caller,
  Import,
  FromImport,
  FunCall,
  Pipe,
  PipeAsync,
  Filter,
  FilterAsync,
  KeywordArgs,
  Block,
  Super,
  TemplateRef,
  Extends,
  Include,
  Set as AstSet,
  Switch,
  Case,
  Output,
  Capture,
  TemplateData,
  UnaryOp,
  BinOp,
  In,
  Is,
  Or,
  And,
  NullishCoalesce,
  Not,
  Add,
  Concat,
  Sub,
  Mul,
  Div,
  FloorDiv,
  Mod,
  Pow,
  Neg,
  Pos,
  Compare,
  CompareOperand,
  CallExtension,
  CallExtensionAsync,
} from './src/nodes/index.js';
import installJinjaCompat from './src/jinja-compat.js';
import {
  precompile,
  precompileString,
} from './src/precompile.js';
import { setErrorConfig } from './src/error/config.js';

let _env = null;

const nodes = {
  Node,
  NodeList,
  Value,
  Root,
  Literal,
  AstSymbol,
  Group,
  ArrayNode,
  Array,
  Pair,
  Dict,
  LookupVal,
  OptionalChain,
  Slice,
  If,
  IfAsync,
  InlineIf,
  For,
  AsyncEach,
  AsyncAll,
  Macro,
  Caller,
  Import,
  FromImport,
  FunCall,
  Pipe,
  PipeAsync,
  Filter,
  FilterAsync,
  KeywordArgs,
  Block,
  Super,
  TemplateRef,
  Extends,
  Include,
  Set: AstSet,
  Switch,
  Case,
  Output,
  Capture,
  TemplateData,
  UnaryOp,
  BinOp,
  In,
  Is,
  Or,
  And,
  NullishCoalesce,
  Not,
  Add,
  Concat,
  Sub,
  Mul,
  Div,
  FloorDiv,
  Mod,
  Pow,
  Neg,
  Pos,
  Compare,
  CompareOperand,
  CallExtension,
  CallExtensionAsync,
};

const createLoader = (loaders, templatesPath, opts) => {
  if (loaders.FileSystemLoader) {
    return new loaders.FileSystemLoader(templatesPath, {
      watch: opts.watch,
      noCache: opts.noCache
    });
  }
  if (loaders.WebLoader) {
    return new loaders.WebLoader(templatesPath, {
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
  if (isPlainObject(templatesPath)) {
    return { opts: templatesPath, templatesPath: null };
  }
  if (opts.mode === 'development') {
    opts.watch = opts.watch !== false;
  }
  return { opts, templatesPath };
};

const loaders = {
  FileSystemLoader,
  NodeResolveLoader,
  PrecompiledLoader,
  WebLoader,
};

const compiler = {
  Compiler,
  compile: compileSourceToCode,
  getSourceMap,
  getSourceMapFromCompile,
};

const parser = {
  Parser,
  parse,
};

const lexer = {
  Tokenizer,
  lex,
  createToken,
  TOKEN_BLOCK_END,
  TOKEN_BLOCK_START,
  TOKEN_BOOLEAN,
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_FLOAT,
  TOKEN_INT,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
  TOKEN_NONE,
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_REGEX,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_RIGHT_PAREN,
  TOKEN_SPECIAL,
  TOKEN_STRING,
  TOKEN_SYMBOL,
  TOKEN_TILDE,
  TOKEN_TYPES,
  TOKEN_VARIABLE_END,
  TOKEN_VARIABLE_START,
  TOKEN_WHITESPACE,
  WHITESPACE_CHARS,
  DELIM_CHARS,
  INT_CHARS,
  COMPLEX_OPERATORS,
  REGEX_FLAGS,
  createDelimiters,
};

const runtime = {
  Frame,
  SafeString,
  copySafeness,
  markSafe,
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  asyncEach,
  asyncAll,
  isArray,
  keys,
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  handleError,
  fromIterator,
  inOperator,
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

export const compileTemplate = (src, env, path, eagerCompile) => new Template(src, env, path, eagerCompile);

export const render = (name, ctx) => getEnv().render(name, ctx);

export const renderString = (src, ctx) => getEnv().renderString(src, ctx);

export { Environment, Template };
export { Loader };
export { FileSystemLoader };
export { NodeResolveLoader };
export { PrecompiledLoader };
export { WebLoader };
export { compiler, parser, lexer, runtime, nodes, installJinjaCompat };
export { precompile, precompileString };
export { getConfig, renderError, renderErrorString, createEnvironment as ErrorEnvironment } from './src/error/index.js';

export default {
  Environment,
  Template,
  Loader,
  FileSystemLoader,
  NodeResolveLoader,
  PrecompiledLoader,
  WebLoader,
  compiler,
  parser,
  lexer,
  runtime,
  nodes,
  installJinjaCompat,
  configure,
  reset,
  compileTemplate,
  render,
  renderString,
  precompile,
  precompileString
};
