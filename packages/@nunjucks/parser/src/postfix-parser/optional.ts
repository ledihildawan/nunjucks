import { TOKEN_SYMBOL, TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_COMMA, TOKEN_LEFT_BRACKET } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, peekToken, fail } from "../cursor.ts";
import type { ParserContext, MutableNode } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { BracketNotation } from "./lookup.ts";

const parseOptionalCallArgs = (ctx: ParserContext, tok: Token): MutableNode => {
  const args = nodes.nodeList(tok.lineno, tok.colno) as MutableNode;
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

    const arg = parseExpression(ctx);
    args.addChild(arg);
    expectComma = true;
  }

  return args;
};

export const parseOptionalChain = (ctx: ParserContext, tok: Token, target: Node): Node => {
  nextToken(ctx);
  const val = peekToken(ctx);

  if (val && val.type === TOKEN_LEFT_PAREN) {
    nextToken(ctx);
    const args = parseOptionalCallArgs(ctx, tok);
    return nodes.optionalCall(tok.lineno, tok.colno, target, args as unknown as Node[]);
  }

  // Check if next token is bracket or dot
    const nextTok = peekToken(ctx);
  if (nextTok && nextTok.type === TOKEN_LEFT_BRACKET) {
    // Handle bracket notation: user?.["status"]
    nextToken(ctx); // consume [
    const start = parseExpression(ctx);

    // consume ]
    const rightBracket = nextToken(ctx);
    if (rightBracket.type !== 'right-bracket') {
      fail(ctx, 'expected right bracket', rightBracket.lineno, rightBracket.colno);
    }

    const node = nodes.optionalChain(tok.lineno, tok.colno, target, start);
    (node as Node & { [BracketNotation]?: boolean })[BracketNotation] = true;
    return node;
  }

  // Handle dot notation: user?.status
  const val2 = nextToken(ctx);

  if (val2.type !== TOKEN_SYMBOL) {
    const targetName = (target?.name as string) || 'expression';
    fail(ctx, 'expected name as lookup value after ?. on ' + targetName + ', got ' + val2.value,
      val2.lineno,
      val2.colno);
  }

  const lookup = nodes.literal(val2.lineno, val2.colno, val2.value);
  const node = nodes.optionalChain(tok.lineno, tok.colno, target, lookup);
  (node as Node & { [BracketNotation]?: boolean })[BracketNotation] = false;
  return node;
};
