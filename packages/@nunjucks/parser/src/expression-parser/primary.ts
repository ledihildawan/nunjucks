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
import { tryParsePattern, parseAggregate, parseTemplateLiteral } from "../node-parsers/index.ts";
import { parsePostfix } from "../postfix-parser/index.ts";

export const parsePrimary = (ctx: ParserContext, noPostfix?: boolean): Node => {
  const tok = nextToken(ctx);
  let val;
  let node: Node | null = null;

  if (!tok) {
    fail(ctx, 'expected expression, got end of file');
  } else if (tok.type === TOKEN_STRING) {
    val = tok.value;
  } else if (tok.type === TOKEN_INT) {
    val = Number(tok.value);
  } else if (tok.type === TOKEN_FLOAT) {
    val = parseFloat(tok.value as string);
  } else if (tok.type === TOKEN_BOOLEAN) {
    if (tok.value === 'true') {
      val = true;
    } else if (tok.value === 'false') {
      val = false;
    } else {
      fail(ctx, 'invalid boolean: ' + tok.value,
        tok.lineno,
        tok.colno);
    }
  } else if (tok.type === TOKEN_NONE) {
    val = null;
  } else if (tok.type === TOKEN_REGEX) {
    val = new RegExp((tok.value as { body: string; flags: string }).body, (tok.value as { body: string; flags: string }).flags);
  }

  if (val !== undefined) {
    node = literal(tok.lineno, tok.colno, val);
  } else if (tok.type === TOKEN_SYMBOL) {
    node = symbol(tok.lineno, tok.colno, tok.value as string);
  } else if (tok.type === TOKEN_TEMPLATE_LITERAL) {
    pushToken(ctx, tok);
    node = parseTemplateLiteral(ctx);
  } else {
    pushToken(ctx, tok);
    try {
      node = parseAggregate(ctx);
    } catch (e) {
      if (e !== null && typeof e === 'object' && (e as { sentinel?: unknown }).sentinel === EXPECTED_COLON_AFTER_DICT_KEY) {
        node = tryParsePattern(ctx);
        if (!node) {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }

  if (!noPostfix) {
    node = parsePostfix(ctx, node!);
  }

  if (node) {
    return node;
  }

  return fail(ctx, `unexpected token: ${tok.value}`, tok.lineno, tok.colno);
};
