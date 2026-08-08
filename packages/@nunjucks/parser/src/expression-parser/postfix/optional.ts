import { TOKEN_SYMBOL, TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_COMMA, TOKEN_LEFT_BRACKET, type TOKEN_OPERATOR } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { appendChild, literal, nodeList, optionalCall, optionalChain } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { nextToken, peekToken, fail } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { parseExpression } from "../index.ts";
import { markBracketNotation } from "./lookup.ts";

type OptionalChainOperatorToken = Token & { type: typeof TOKEN_OPERATOR };

const isEndOfArgs = (next: Token): boolean =>
  !next || next.type === TOKEN_RIGHT_PAREN;

const handleComma = (parserContext: ParserContext, expectComma: boolean): boolean => {
  if (!expectComma) { return true; }
  const next = peekToken(parserContext);
  if (next?.type !== TOKEN_COMMA) {
    fail(parserContext, 'expected comma after expression', next?.lineno ?? 0, next?.colno ?? 0);
  }
  nextToken(parserContext);
  return true;
};

const parseOptionalCallArgs = (parserContext: ParserContext, tok: Token): ChildrenNode => {
  let args = nodeList(tok.lineno, tok.colno);
  let expectComma = false;

  for (;;) {
    const next = peekToken(parserContext);
    if (isEndOfArgs(next)) {
      if (next) {
        nextToken(parserContext);
      }
      break;
    }

    if (!handleComma(parserContext, expectComma)) { break; }

    const argument = parseExpression(parserContext);
    args = appendChild(args, argument);
    expectComma = true;
  }

  return args;
};

export const parseOptionalChain = (parserContext: ParserContext, tok: OptionalChainOperatorToken, target: Node): Node => {
  nextToken(parserContext);
  const value = peekToken(parserContext);

  if (value?.type === TOKEN_LEFT_PAREN) {
    nextToken(parserContext);
    const args = parseOptionalCallArgs(parserContext, tok);
    return optionalCall(tok.lineno, tok.colno, target, [...args.children]);
  }

    const nextTok = peekToken(parserContext);
  if (nextTok?.type === TOKEN_LEFT_BRACKET) {
    nextToken(parserContext);
    const start = parseExpression(parserContext);

    const rightBracket = nextToken(parserContext);
    if (rightBracket.type !== 'right-bracket') {
      fail(parserContext, 'expected right bracket', rightBracket.lineno, rightBracket.colno);
    }

    const node = optionalChain(tok.lineno, tok.colno, target, start);
    markBracketNotation(node, true);
    return node;
  }

  const nameTok = nextToken(parserContext);

  if (nameTok.type !== TOKEN_SYMBOL) {
    const targetName = (target ? String(target.value ?? 'expression') : 'expression');
    fail(parserContext, `expected name as lookup value after ?. on ${targetName}, got ${nameTok.value}`,
      nameTok.lineno,
      nameTok.colno);
  }

  const lookup = literal(nameTok.lineno, nameTok.colno, nameTok.value);
  const node = optionalChain(tok.lineno, tok.colno, target, lookup);
  markBracketNotation(node, false);
  return node;
};
