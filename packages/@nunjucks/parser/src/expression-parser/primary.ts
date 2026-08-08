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

const parseBooleanValue = (tok: Token): boolean | undefined => {
  if (tok.value === 'true') { return true; }
  if (tok.value === 'false') { return false; }
  return undefined;
};

const handleLiteralToken = (tok: Token, parserContext: ParserContext): Node | undefined => {
  switch (tok.type) {
    case TOKEN_STRING:
      return literal(tok.lineno, tok.colno, tok.value);
    case TOKEN_INT:
    case TOKEN_FLOAT:
      return literal(tok.lineno, tok.colno, tok.value);
    case TOKEN_BOOLEAN: {
      const value = parseBooleanValue(tok);
      if (value === undefined) {
        fail(parserContext, `invalid boolean: ${tok.value}`, tok.lineno, tok.colno);
      }
      return literal(tok.lineno, tok.colno, value);
    }
    case TOKEN_NONE:
      return literal(tok.lineno, tok.colno, null);
    case TOKEN_REGEX: {
      const { body, flags } = tok.value;
      return literal(tok.lineno, tok.colno, new RegExp(body, flags));
    }
  }
  return undefined;
};

const handleSymbolOrTemplate = (tok: Token, parserContext: ParserContext): Node | null => {
  if (isSymbolToken(tok)) {
    return symbol(tok.lineno, tok.colno, tok.value);
  }
  if (tok.type === TOKEN_TEMPLATE_LITERAL) {
    pushToken(parserContext, tok);
    return parseTemplateLiteral(parserContext);
  }
  return null;
};

const parseAggregateOrPattern = (parserContext: ParserContext): Node | null => {
  try {
    return parseAggregate(parserContext);
  } catch (e) {
    if (e !== null && typeof e === 'object' && (e as { sentinel?: unknown }).sentinel === EXPECTED_COLON_AFTER_DICT_KEY) {
      const node = tryParsePattern(parserContext);
      if (!node) {
        throw e;
      }
      return node;
    }
    throw e;
  }
};

const parsePrimary = (parserContext: ParserContext, noPostfix?: boolean): Node => {
  const tok = nextToken(parserContext);

  if (!tok) {
    fail(parserContext, 'expected expression, got end of file');
  }

  const literalNode = handleLiteralToken(tok, parserContext);
  if (literalNode) {
    return noPostfix ? literalNode : parsePostfix(parserContext, literalNode);
  }

  const symbolNode = handleSymbolOrTemplate(tok, parserContext);
  if (symbolNode) {
    return noPostfix ? symbolNode : parsePostfix(parserContext, symbolNode);
  }

  pushToken(parserContext, tok);
  const aggregateNode = parseAggregateOrPattern(parserContext);
  if (!aggregateNode) {
    return fail(parserContext, `expected expression, got ${tok.type}`, tok.lineno, tok.colno);
  }
  return noPostfix ? aggregateNode : parsePostfix(parserContext, aggregateNode);
};

const parseUnary = (parserContext: ParserContext, noPipes?: boolean): Node => {
  const tok = peekToken(parserContext);
  let node: Node;

  if (skipValue(parserContext, TOKEN_OPERATOR, '-')) {
    node = neg(tok.lineno, tok.colno, parseUnary(parserContext, true));
  } else if (skipValue(parserContext, TOKEN_OPERATOR, '+')) {
    node = pos(tok.lineno, tok.colno, parseUnary(parserContext, true));
  } else if (skipValue(parserContext, TOKEN_OPERATOR, '~')) {
    node = bitwiseNot(tok.lineno, tok.colno, parseUnary(parserContext, true));
  } else if (skipValue(parserContext, TOKEN_OPERATOR, '++')) {
    node = increment(tok.lineno, tok.colno, parseUnary(parserContext, true), false);
  } else if (skipValue(parserContext, TOKEN_OPERATOR, '--')) {
    node = decrement(tok.lineno, tok.colno, parseUnary(parserContext, true), false);
  } else {
    node = parsePrimary(parserContext);
  }

  if (!noPipes) {
    node = parsePipeForward(parserContext, node);
  }

  return node;
};

export { parsePrimary, parseUnary };
