import {
  // AST node constructors for extensions
  Literal,
  AstSymbol,
  Group,
  Array as ArrayNode,
  Pair,
  Dict,
  FunCall,
  Caller,
  Pipe,
  PipeAsync,
  Filter,
  LookupVal,
  Compare,
  CompareOperand,
  InlineIf,
  In as OperatorIn,
  Is,
  And,
  Or,
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
  OptionalChain,
  NullishCoalesce,
  NodeList,
  Slice,
  For,
  AsyncEach,
  AsyncAll,
  If,
  IfAsync,
  Set as AstSet,
  Switch,
  Case,
  Block,
  Output,
  TemplateData,
  Extends,
  Include,
  Import,
  FromImport,
  Macro,
  KeywordArgs,
  CallExtension,
  CallExtensionAsync,
  Capture,
  TemplateRef,
  Super,
} from '../../nodes.js';
import {
  TOKEN_SYMBOL,
  TOKEN_BLOCK_END,
  TOKEN_BLOCK_START,
  TOKEN_VARIABLE_END,
  TOKEN_VARIABLE_START,
  TOKEN_COMMENT,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_LEFT_BRACKET,
  TOKEN_RIGHT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_RIGHT_CURLY,
  TOKEN_OPERATOR,
  TOKEN_COMMA,
  TOKEN_COLON,
  TOKEN_TILDE,
  TOKEN_PIPEFORWARD,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_STRING,
  TOKEN_DATA,
  TOKEN_WHITESPACE,
  TOKEN_REGEX,
} from '../../lexer/token-types.js';
import { peekToken, fail } from '../cursor.js';
import { parseFor } from './for.js';
import { parseMacro } from './macro.js';
import { parseCall } from './call.js';
import { parseImport } from './import.js';
import { parseFrom } from './from.js';
import { parseBlock } from './block.js';
import { parseExtends } from './extends.js';
import { parseInclude } from './include.js';
import { parseIf } from './if.js';
import { parseSet } from './set.js';
import { parseSwitch } from './switch.js';
import { parseRaw } from './raw.js';
import { parseFilterStatement } from './filter.js';
import { parseWithContext } from './with.js';

const nodes = {
  Literal, Symbol: AstSymbol, Group, Array: ArrayNode, Pair, Dict,
  FunCall, Caller, Pipe, PipeAsync, Filter, LookupVal, Compare,
  CompareOperand, InlineIf, In: OperatorIn, Is, And, Or, Not, Add,
  Concat, Sub, Mul, Div, FloorDiv, Mod, Pow, Neg, Pos, OptionalChain,
  NullishCoalesce, NodeList, Slice, For, AsyncEach, AsyncAll, If,
  IfAsync, Set: AstSet, Switch, Case, Block, Output, TemplateData,
  Extends, Include, Import, FromImport, Macro, KeywordArgs,
  CallExtension, CallExtensionAsync, Capture, TemplateRef, Super,
};

const lexer = {
  TOKEN_SYMBOL,
  TOKEN_BLOCK_END,
  TOKEN_BLOCK_START,
  TOKEN_VARIABLE_END,
  TOKEN_VARIABLE_START,
  TOKEN_COMMENT,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_LEFT_BRACKET,
  TOKEN_RIGHT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_RIGHT_CURLY,
  TOKEN_OPERATOR,
  TOKEN_COMMA,
  TOKEN_COLON,
  TOKEN_TILDE,
  TOKEN_PIPEFORWARD,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_STRING,
  TOKEN_DATA,
  TOKEN_WHITESPACE,
  TOKEN_REGEX,
};

export {
  parseFor,
  parseMacro,
  parseCall,
  parseImport,
  parseFrom,
  parseBlock,
  parseExtends,
  parseInclude,
  parseIf,
  parseSet,
  parseSwitch,
  parseRaw,
  parseFilterStatement,
  parseWithContext,
};

export const parseStatement = (ctx) => {
  const tok = peekToken(ctx);

  if (tok.type !== lexer.TOKEN_SYMBOL) {
    fail(ctx, 'tag name expected', tok.lineno, tok.colno);
  }

  if (ctx.breakOnBlocks &&
    (ctx.breakOnBlocks || []).indexOf(tok.value) !== -1) {
    return null;
  }

  switch (tok.value) {
    case 'raw':
      return parseRaw(ctx);
    case 'verbatim':
      return parseRaw(ctx, 'verbatim');
    case 'if':
    case 'ifAsync':
      return parseIf(ctx);
    case 'for':
    case 'asyncEach':
    case 'asyncAll':
      return parseFor(ctx);
    case 'block':
      return parseBlock(ctx);
    case 'extends':
      return parseExtends(ctx);
    case 'include':
      return parseInclude(ctx);
    case 'set':
      return parseSet(ctx);
    case 'macro':
      return parseMacro(ctx);
    case 'call':
      return parseCall(ctx);
    case 'import':
      return parseImport(ctx);
    case 'from':
      return parseFrom(ctx);
    case 'filter':
      return parseFilterStatement(ctx);
    case 'switch':
      return parseSwitch(ctx);
    default:
      if (ctx.extensions.length) {
        for (let i = 0; i < ctx.extensions.length; i++) {
          const ext = ctx.extensions[i];
          if ((ext.tags || []).indexOf(tok.value) !== -1) {
            return ext.parse(ctx, nodes, lexer);
          }
        }
      }
      fail(ctx, 'unknown block tag: ' + tok.value, tok.lineno, tok.colno);
  }
};
