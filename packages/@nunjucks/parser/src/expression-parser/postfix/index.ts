import {
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
} from '@nunjucks/lexer';
import { decrement, increment } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, peekToken } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { parseFunCall } from "./fun-call.ts";
import { parseBracketAccess } from "./lookup.ts";
import { parseDotAccess } from "./dot.ts";
import { parseOptionalChain } from "./optional.ts";
import { loc } from '@nunjucks/shared';

export const parsePostfix = (parserContext: ParserContext, node: Node): Node => {
  let current = node;

  for (;;) {
    const tok = peekToken(parserContext);

    switch (tok.type) {
      case TOKEN_LEFT_PAREN:
        current = parseFunCall(parserContext, tok, current);
        continue;
      case TOKEN_LEFT_BRACKET:
        nextToken(parserContext);
        current = parseBracketAccess(parserContext, tok, current);
        continue;
      case TOKEN_OPERATOR:
        if (tok.value === '.') {
          current = parseDotAccess(parserContext, tok, current);
          continue;
        }
        if (tok.value === '?.') {
          current = parseOptionalChain(parserContext, tok, current);
          continue;
        }
        if (tok.value === '++') {
          nextToken(parserContext);
          current = increment(loc(tok), current, true);
          continue;
        }
        if (tok.value === '--') {
          nextToken(parserContext);
          current = decrement(loc(tok), current, true);
          continue;
        }
        return current;
      default:
        return current;
    }
  }
};

export { parsePipeForward, parseFilterCallName, parseFilterCallArgs } from './pipe-forward.ts';
