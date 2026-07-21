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
import { parseVariableDeclaration, parseVariableAssignment, parseDefineBlock } from "./variable.ts";
import { parseSwitch } from "./switch.ts";
import { parseRaw } from "./raw.ts";
import { parseFilterStatement } from "./filter.ts";
import { parseWithContext } from "./with.ts";
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
  parseSwitch,
  parseRaw,
  parseFilterStatement,
  parseWithContext,
  parseVariableDeclaration,
  parseVariableAssignment,
  parseDefineBlock,
};

export const parseStatement = (ctx: ParserContext): Node | null => {
  const tok = peekToken(ctx);

  if (tok.type !== lexer.TOKEN_SYMBOL) {
    fail(ctx, 'tag name expected', tok.lineno, tok.colno);
  }

  if (ctx.breakOnBlocks &&
    (ctx.breakOnBlocks || []).includes(tok.value as string)) {
    return null;
  }

  switch (tok.value as string) {
    case 'raw':
      return parseRaw(ctx);
    case 'verbatim':
      return parseRaw(ctx, 'verbatim');
    case 'if':
      return parseIf(ctx);
    case 'for':
      return parseFor(ctx);
    case 'block':
      return parseBlock(ctx);
    case 'extends':
      return parseExtends(ctx);
    case 'include':
      return parseInclude(ctx);
    case 'define':
      return parseDefineBlock(ctx);
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
    case 'try':
      return parseTry(ctx);
    case 'do':
      return parseDo(ctx);
    case 'with':
      return parseWith(ctx);
    default:
      if (ctx.extensions.length) {
        for (let i = 0; i < ctx.extensions.length; i++) {
          const ext = ctx.extensions[i]!;
          if ((ext.tags || []).includes(tok.value as string)) {
            return ext.parse!(ctx, nodes, lexer);
          }
        }
      }
      return fail(ctx, `unknown block tag: ${tok.value}`, tok.lineno, tok.colno);
  }
};
