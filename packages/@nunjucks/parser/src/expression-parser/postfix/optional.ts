import { TOKEN_SYMBOL, TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_COMMA, TOKEN_LEFT_BRACKET } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { appendChild, literal, nodeList, optionalCall, optionalChain } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { nextToken, peekToken, fail } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { parseExpression } from "../index.ts";
import { markBracketNotation } from "./lookup.ts";

const isEndOfArgs = (next: Token): boolean =>
  !next || next.type === TOKEN_RIGHT_PAREN;

const handleComma = (ctx: ParserContext, expectComma: boolean): boolean => {
  if (!expectComma) { return true; }
  const next = peekToken(ctx);
  if (next?.type !== TOKEN_COMMA) {
    fail(ctx, 'expected comma after expression', next?.lineno ?? 0, next?.colno ?? 0);
  }
  nextToken(ctx);
  return true;
};

const parseOptionalCallArgs = (ctx: ParserContext, tok: Token): ChildrenNode => {
  let args = nodeList(tok.lineno, tok.colno);
  let expectComma = false;

  for (;;) {
    const next = peekToken(ctx);
    if (isEndOfArgs(next)) {
      if (next) {
        nextToken(ctx);
      }
      break;
    }

    if (!handleComma(ctx, expectComma)) { break; }

    const arg = parseExpression(ctx);
    args = appendChild(args, arg);
    expectComma = true;
  }

  return args;
};

export const parseOptionalChain = (ctx: ParserContext, tok: Token, target: Node): Node => {
  nextToken(ctx);
  const val = peekToken(ctx);

  if (val?.type === TOKEN_LEFT_PAREN) {
    nextToken(ctx);
    const args = parseOptionalCallArgs(ctx, tok);
    return optionalCall(tok.lineno, tok.colno, target, [...args.children]);
  }

    const nextTok = peekToken(ctx);
  if (nextTok?.type === TOKEN_LEFT_BRACKET) {
    nextToken(ctx);
    const start = parseExpression(ctx);

    const rightBracket = nextToken(ctx);
    if (rightBracket.type !== 'right-bracket') {
      fail(ctx, 'expected right bracket', rightBracket.lineno, rightBracket.colno);
    }

    const node = optionalChain(tok.lineno, tok.colno, target, start);
    markBracketNotation(node, true);
    return node;
  }

  const val2 = nextToken(ctx);

  if (val2.type !== TOKEN_SYMBOL) {
    const targetName = (target ? String(target.value ?? 'expression') : 'expression');
    fail(ctx, `expected name as lookup value after ?. on ${targetName}, got ${val2.value}`,
      val2.lineno,
      val2.colno);
  }

  const lookup = literal(val2.lineno, val2.colno, val2.value);
  const node = optionalChain(tok.lineno, tok.colno, target, lookup);
  markBracketNotation(node, false);
  return node;
};
