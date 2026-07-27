import {
  TOKEN_STRING,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_REGEX,
  TOKEN_SYMBOL,
  TOKEN_TEMPLATE_LITERAL,
} from '@nunjucks/lexer';
import { literal, symbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, pushToken, fail, EXPECTED_COLON_AFTER_DICT_KEY } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { tryParsePattern } from "../node-parsers/pattern.ts";
import { parseAggregate } from "../node-parsers/aggregate/index.ts";
import { parseTemplateLiteral } from "../node-parsers/template-literal.ts";
import { parsePostfix } from "../postfix-parser/index.ts";

const parseBooleanValue = (tok: ReturnType<typeof nextToken>): unknown => {
  if (tok.value === 'true') { return true; }
  if (tok.value === 'false') { return false; }
  return undefined;
};

const handleLiteralToken = (tok: ReturnType<typeof nextToken>, ctx: ParserContext): Node | undefined => {
  switch (tok.type) {
    case TOKEN_STRING:
      return literal(tok.lineno, tok.colno, tok.value);
    case TOKEN_INT:
      return literal(tok.lineno, tok.colno, Number(tok.value));
    case TOKEN_FLOAT:
      return literal(tok.lineno, tok.colno, Number.parseFloat(tok.value as string));
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

const handleSymbolOrTemplate = (tok: ReturnType<typeof nextToken>, ctx: ParserContext): Node | null => {
  if (tok.type === TOKEN_SYMBOL) {
    return symbol(tok.lineno, tok.colno, tok.value as string);
  }
  if (tok.type === TOKEN_TEMPLATE_LITERAL) {
    pushToken(ctx, tok);
    return parseTemplateLiteral(ctx);
  }
  return null;
};

const parseAggregateOrPattern = (ctx: ParserContext): Node => {
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

export const parsePrimary = (ctx: ParserContext, noPostfix?: boolean): Node => {
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
  return noPostfix ? aggregateNode : parsePostfix(ctx, aggregateNode);
};
