import {
  nodes,
} from '@nunjucks/nodes';
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
} from '@nunjucks/lexer';
import { peekToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import type { Node } from '@nunjucks/nodes';
import { parseFor } from "./for.ts";
import { parseMacro } from "./macro.ts";
import { parseCall } from "./call.ts";
import { parseImport } from "./import.ts";
import { parseFrom } from "./from.ts";
import { parseBlock } from "./block.ts";
import { parseExtends } from "./extends.ts";
import { parseInclude } from "./include.ts";
import { parseIf } from "./if.ts";
import { parseDefineBlock } from "./variable.ts";
import { parseSwitch } from "./switch.ts";
import { parseRaw } from "./raw.ts";
import { parseFilterStatement } from "./filter.ts";
import { parseTry } from "./try-catch.ts";
import { parseDo } from "./do.ts";
import { parseWith } from "./with-block.ts";

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

// Public surface of the statement parsers. Re-exported from their own modules
// rather than re-listing the imports above, which exist for parseStatement.
export { parseFor } from './for.ts';
export { parseMacro } from './macro.ts';
export { parseCall } from './call.ts';
export { parseImport } from './import.ts';
export { parseFrom } from './from.ts';
export { parseBlock } from './block.ts';
export { parseExtends } from './extends.ts';
export { parseInclude } from './include.ts';
export { parseIf } from './if.ts';
export { parseSwitch } from './switch.ts';
export { parseRaw } from './raw.ts';
export { parseFilterStatement } from './filter.ts';
export { parseWithContext } from './with.ts';
export { parseVariableDeclaration, parseVariableAssignment, parseDefineBlock } from './variable.ts';

type StatementParser = (ctx: ParserContext) => Node;
type TaggedParser = (ctx: ParserContext, ...args: unknown[]) => Node;

const STATEMENT_PARSERS: Record<string, StatementParser | TaggedParser> = {
  raw: parseRaw,
  verbatim: (ctx) => parseRaw(ctx, 'verbatim'),
  if: parseIf,
  for: parseFor,
  block: parseBlock,
  extends: parseExtends,
  include: parseInclude,
  define: parseDefineBlock,
  macro: parseMacro,
  call: parseCall,
  import: parseImport,
  from: parseFrom,
  filter: parseFilterStatement,
  switch: parseSwitch,
  try: parseTry,
  do: parseDo,
  with: parseWith,
};

const _parseStatement = (ctx: ParserContext): Node | null => {
  const tok = peekToken(ctx);

  if (tok.type !== lexer.TOKEN_SYMBOL) {
    fail(ctx, 'tag name expected', tok.lineno, tok.colno);
  }

  if (ctx.breakOnBlocks && (ctx.breakOnBlocks || []).includes(tok.value as string)) {
    return null;
  }

  const tagName = tok.value as string;
  const parser = STATEMENT_PARSERS[tagName];
  if (parser) {
    return parser(ctx) as Node;
  }

  for (const ext of ctx.extensions) {
    if ((ext.tags || []).includes(tagName) && ext.parse) {
      return ext.parse(ctx, nodes, lexer);
    }
  }
  return fail(ctx, `unknown block tag: ${tok.value}`, tok.lineno, tok.colno);
};
