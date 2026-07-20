import { TOKEN_SYMBOL, TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_COMMA, TOKEN_LEFT_BRACKET } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { nextToken, peekToken, fail } from '../cursor.js';
import { BracketNotation } from './lookup.js';

const parseOptionalCallArgs = (ctx, tok) => {
  const args = nodes.nodeList(tok.lineno, tok.colno);
  let expectComma = false;

  while (true) {
    const next = peekToken(ctx);
    if (!next || next.type === TOKEN_RIGHT_PAREN) {
      if (next) {
        nextToken(ctx);
      }
      break;
    }

    if (expectComma) {
      if (next.type !== TOKEN_COMMA) {
        fail(ctx, 'expected comma after expression', next.lineno, next.colno);
      }
      nextToken(ctx);
    }

    const arg = ctx.parseExpression();
    args.addChild(arg);
    expectComma = true;
  }

  return args;
};

export const parseOptionalChain = (ctx, tok, target) => {
  nextToken(ctx);
  const val = peekToken(ctx);

  if (val && val.type === TOKEN_LEFT_PAREN) {
    nextToken(ctx);
    const args = parseOptionalCallArgs(ctx, tok);
    return nodes.optionalCall(tok.lineno, tok.colno, target, args);
  }

  // Check if next token is bracket or dot
    const nextTok = peekToken(ctx);
  if (nextTok && nextTok.type === TOKEN_LEFT_BRACKET) {
    // Handle bracket notation: user?.["status"]
    nextToken(ctx); // consume [
    const start = ctx.parseExpression();
    
    // consume ]
    const rightBracket = nextToken(ctx);
    if (rightBracket.type !== 'right-bracket') {
      fail(ctx, 'expected right bracket', rightBracket.lineno, rightBracket.colno);
    }
    
    const node = nodes.optionalChain(tok.lineno, tok.colno, target, start);
    node[BracketNotation] = true;
    return node;
  }

  // Handle dot notation: user?.status
  const val2 = nextToken(ctx);

  if (val2.type !== TOKEN_SYMBOL) {
    const targetName = target?.name || 'expression';
    fail(ctx, 'expected name as lookup value after ?. on ' + targetName + ', got ' + val2.value,
      val2.lineno,
      val2.colno);
  }

  const lookup = nodes.literal(val2.lineno, val2.colno, val2.value);
  const node = nodes.optionalChain(tok.lineno, tok.colno, target, lookup);
  node[BracketNotation] = false;
  return node;
};
