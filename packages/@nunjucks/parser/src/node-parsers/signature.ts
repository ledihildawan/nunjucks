import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
  TOKEN_RIGHT_PAREN,
} from '@nunjucks/lexer';
import { appendChild, isAssignmentPattern, keywordArgs, nodeList, pair } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { nextToken, peekToken, skip, skipValue, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";

export const parseSignature = (ctx: ParserContext, tolerant?: boolean, noParens?: boolean): Node | null => {
  let tok = peekToken(ctx);
  if (!noParens && tok.type !== TOKEN_LEFT_PAREN) {
    if (tolerant) {
      return null;
    }
      fail(ctx, 'expected arguments', tok.lineno, tok.colno);
  }

  if (tok.type === TOKEN_LEFT_PAREN) {
    tok = nextToken(ctx);
  }

  let args: ChildrenNode = nodeList(tok.lineno, tok.colno);
  let kwargs: ChildrenNode = keywordArgs(tok.lineno, tok.colno);
  let checkComma = false;

  while (true) {
    tok = peekToken(ctx);
    if (!noParens && tok.type === TOKEN_RIGHT_PAREN) {
      nextToken(ctx);
      break;
    }if (noParens && tok.type === TOKEN_BLOCK_END) {
      break;
    }

    if (checkComma && !skip(ctx, TOKEN_COMMA)) {
      fail(ctx, 'parseSignature: expected comma after expression',
        tok.lineno,
        tok.colno);
    } else {
      const arg = parseExpression(ctx);

      if (isAssignmentPattern(arg) && peekToken(ctx)?.type === TOKEN_OPERATOR && peekToken(ctx)?.value === '=') {
        nextToken(ctx);
        const value = parseExpression(ctx);
        kwargs = appendChild(kwargs, pair(arg.lineno, arg.colno, arg.target as Node, value));
      } else if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
        kwargs = appendChild(kwargs,
          pair(arg.lineno,
            arg.colno,
            arg,
            parseExpression(ctx))
        );
      } else {
        args = appendChild(args, arg);
      }
    }

    checkComma = true;
  }

  if (kwargs.children.length > 0) {
    args = appendChild(args, kwargs);
  }

  return args;
};
