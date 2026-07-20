import {
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
} from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { nextToken, peekToken, fail } from '../cursor.js';
import { parseFunCall } from './fun-call.js';
import { parseBracketAccess } from './lookup.js';
import { parseDotAccess } from './dot.js';
import { parseOptionalChain } from './optional.js';
import { parsePipe, parseFilterName, parseFilterArgs } from './pipe.js';

export const parsePostfix = (ctx, node) => {
  let tok = peekToken(ctx);

  while (tok) {
    if (tok.type === TOKEN_LEFT_PAREN) {
      node = parseFunCall(ctx, tok, node);
    } else if (tok.type === TOKEN_LEFT_BRACKET) {
      const bracketTok = nextToken(ctx);
      node = parseBracketAccess(ctx, bracketTok, node);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '.') {
      node = parseDotAccess(ctx, tok, node);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '?.') {
      node = parseOptionalChain(ctx, tok, node);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '++') {
      nextToken(ctx);
      node = nodes.increment(tok.lineno, tok.colno, node, true);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '--') {
      nextToken(ctx);
      node = nodes.decrement(tok.lineno, tok.colno, node, true);
    } else {
      break;
    }

    tok = peekToken(ctx);
  }

  return node;
};

export { parsePipe, parseFilterName, parseFilterArgs };
