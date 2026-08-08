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
  isSymbolToken,
} from '@nunjucks/lexer';
import { peekToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import type { Node } from '@nunjucks/nodes';
import { find } from 'remeda';
import { STATEMENT_PARSERS } from './registry.ts';

export const parseStatement = (parserContext: ParserContext, breakOn: readonly string[] | null = null): Node | null => {
  const tok = peekToken(parserContext);

  if (tok.type !== TOKEN_SYMBOL) {
    fail(parserContext, 'tag name expected', tok.lineno, tok.colno);
  }

  if (breakOn?.includes(String(tok.value))) {
    return null;
  }

  const tagName = isSymbolToken(tok) ? tok.value : fail(parserContext, 'tag name expected', tok.lineno, tok.colno);
  const parser = STATEMENT_PARSERS[tagName];
  if (parser) {
    return parser(parserContext);
  }

  const ext = find(parserContext.extensions, e => (e.tags ?? []).includes(tagName) && Boolean(e.parse));
  if (ext?.parse) {
    return ext.parse(parserContext, nodes, {
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
    });
  }
  return fail(parserContext, `unknown block tag: ${tok.value}`, tok.lineno, tok.colno);
};
