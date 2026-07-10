import { isPlainObject } from 'remeda';
import { createEnvironment, createSandboxedEnvironment, createTemplate } from './src/environment/index.js';
import { createLoader } from './src/loaders/base.js';
import { createFileSystemLoader } from './src/loaders/file-system.js';
import { createNodeResolveLoader } from './src/loaders/node-resolve.js';
import { createWebLoader } from './src/loaders/web.js';
import { createPrecompiledLoader } from './src/loaders/precompiled.js';
import {
  createCompiler,
  compile,
  getSourceMap,
  getSourceMapFromCompile,
} from './src/compiler/index.js';
import {
  createParser,
  parse,
} from './src/parser/index.js';
import {
  createTokenizer,
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
  createFrame,
  createSafeString,
  isSafeString,
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
  Set,
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
import installJinjaCompat from './src/integration/jinja-compat.js';
import {
  precompile,
  precompileString,
} from './src/precompile/index.js';
import { setErrorConfig } from './src/error/config.js';

const loaderCreators = {
  FileSystemLoader: createFileSystemLoader,
  WebLoader: createWebLoader,
};

const createDefaultEnv = () => {
  let _env = null;

  return {
    configure(templatesPath, opts) {
      const { opts: normalizedOpts, templatesPath: normalizedPath } = normalizeOpts(templatesPath, opts);
      setErrorConfig(normalizedOpts);
      const loader = makeLoader(loaderCreators, normalizedPath, normalizedOpts);
      _env = createEnvironment(loader, normalizedOpts);
      applyExpress(_env, normalizedOpts);
      return _env;
    },
    reset() {
      _env = null;
    },
    getEnv() {
      if (!_env) this.configure();
      return _env;
    }
  };
};

const defaultEnv = createDefaultEnv();

const nodes = {
  Node,
  NodeList,
  Value,
  Root,
  Literal,
  AstSymbol,
  Group,
  ArrayNode,
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
  Set: Set,
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

const makeLoader = (loaders, templatesPath, opts) => {
  if (loaders.FileSystemLoader) {
    return loaders.FileSystemLoader(templatesPath, {
      watch: opts.watch,
      noCache: opts.noCache
    });
  }
  if (loaders.WebLoader) {
    return loaders.WebLoader(templatesPath, {
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

export const configure = defaultEnv.configure.bind(defaultEnv);
export const reset = defaultEnv.reset.bind(defaultEnv);
const getEnv = defaultEnv.getEnv.bind(defaultEnv);

export const compileTemplate = (src, env, path, eagerCompile) => createTemplate(src, env, path, eagerCompile);

export const render = (name, ctx) => getEnv().render(name, ctx);

export const renderString = (src, ctx) => getEnv().renderString(src, ctx);

export {
  createEnvironment,
  createSandboxedEnvironment,
  createTemplate,
  createLoader,
  createFileSystemLoader,
  createNodeResolveLoader,
  createPrecompiledLoader,
  createWebLoader,
  createCompiler,
  compile,
  getSourceMap,
  getSourceMapFromCompile,
  createParser,
  parse,
  createTokenizer,
  lex,
  createToken,
  createFrame,
  createSafeString,
  isSafeString,
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
  nodes,
  installJinjaCompat,
  precompile,
  precompileString,
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

export { getConfig, renderError, renderErrorString } from './src/error/index.js';
