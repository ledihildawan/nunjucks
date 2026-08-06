import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_STRING,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_REGEX,
  TOKEN_OPERATOR,
  TOKEN_TEMPLATE_LITERAL,
  isStringToken,
  isSymbolToken,
} from '@nunjucks/lexer';
import { literal, symbol, neg, pos, bitwiseNot, increment, decrement } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, peekToken, pushToken, skipValue, fail } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { EXPECTED_COLON_AFTER_DICT_KEY } from '../error.ts';
import { tryParsePattern } from '../node-parser/pattern.ts';
import { parseAggregate } from '../node-parser/aggregate/index.ts';
import { parseTemplateLiteral } from '../node-parser/template-literal.ts';
import { parsePostfix, parsePipeForward } from './postfix/index.ts';

const parseBooleanValue = (tok: Token): unknown => {
  if (tok.value === 'true') { return true; }
  if (tok.value === 'false') { return false; }
  return undefined;
};

const handleLiteralToken = (tok: Token, ctx: ParserContext): Node | undefined => {
  switch (tok.type) {
    case TOKEN_STRING:
      return literal(tok.lineno, tok.colno, tok.value);
    case TOKEN_INT:
      return literal(tok.lineno, tok.colno, Number(tok.value));
    case TOKEN_FLOAT:
      return literal(tok.lineno, tok.colno, Number.parseFloat(isStringToken(tok) ? tok.value : String(tok.value)));
    case TOKEN_BOOLEAN: {
      const val = parseBooleanValue(tok);
      if (val === undefined) {
        fail(ctx, `invalid boolean: ${tok.value}`, tok.lineno, tok.colno);
      }
      return literal(tok.lineno, tok.colno, val);
    }
    case TOKEN_NONE:
      return literal(tok.lineno, tok.colno, null);
    case TOKEN_REGEX: {
      const { body, flags } = tok.value as { body: string; flags: string };
      return literal(tok.lineno, tok.colno, new RegExp(body, flags));
    }
  }
  return undefined;
};

const handleSymbolOrTemplate = (tok: Token, ctx: ParserContext): Node | null => {
  if (isSymbolToken(tok)) {
    return symbol(tok.lineno, tok.colno, tok.value);
  }
  if (tok.type === TOKEN_TEMPLATE_LITERAL) {
    pushToken(ctx, tok);
    return parseTemplateLiteral(ctx);
  }
  return null;
};

const parseAggregateOrPattern = (ctx: ParserContext): Node | null => {
  try {
    return parseAggregate(ctx);
  } catch (e) {
    if (e !== null && typeof e === 'object' && (e as { sentinel?: unknown }).sentinel === EXPECTED_COLON_AFTER_DICT_KEY) {
      const node = tryParsePattern(ctx);
      if (!node) {
        throw e;
      }
      return node;
    }
    throw e;
  }
};

const parsePrimary = (ctx: ParserContext, noPostfix?: boolean): Node => {
  const tok = nextToken(ctx);

  if (!tok) {
    fail(ctx, 'expected expression, got end of file');
  }

  const literalNode = handleLiteralToken(tok, ctx);
  if (literalNode) {
    return noPostfix ? literalNode : parsePostfix(ctx, literalNode);
  }

  const symbolNode = handleSymbolOrTemplate(tok, ctx);
  if (symbolNode) {
    return noPostfix ? symbolNode : parsePostfix(ctx, symbolNode);
  }

  pushToken(ctx, tok);
  const aggregateNode = parseAggregateOrPattern(ctx);
  if (!aggregateNode) {
    return fail(ctx, `expected expression, got ${tok.type}`, tok.lineno, tok.colno);
  }
  return noPostfix ? aggregateNode : parsePostfix(ctx, aggregateNode);
};

const parseUnary = (ctx: ParserContext, noPipes?: boolean): Node => {
  const tok = peekToken(ctx);
  let node: Node;

  if (skipValue(ctx, TOKEN_OPERATOR, '-')) {
    node = neg(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '+')) {
    node = pos(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '~')) {
    node = bitwiseNot(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '++')) {
    node = increment(tok.lineno, tok.colno, parseUnary(ctx, true), false);
  } else if (skipValue(ctx, TOKEN_OPERATOR, '--')) {
    node = decrement(tok.lineno, tok.colno, parseUnary(ctx, true), false);
  } else {
    node = parsePrimary(ctx);
  }

  if (!noPipes) {
    node = parsePipeForward(ctx, node);
  }

  return node;
};

export { parsePrimary, parseUnary };
