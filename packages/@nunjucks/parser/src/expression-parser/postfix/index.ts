import {
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
} from '@nunjucks/lexer';
import { decrement, increment } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { nextToken, peekToken } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseFunCall } from "./fun-call.ts";
import { parseBracketAccess } from "./lookup.ts";
import { parseDotAccess } from "./dot.ts";
import { parseOptionalChain } from "./optional.ts";
import { loc } from '@nunjucks/shared';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Result unwrap-and-return short-circuits inflate branching
export const parsePostfix = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  let current = node;

  for (;;) {
    const tokR = peekToken(parserContext);
    if (isErr(tokR)) { return tokR; }
    const tok = tokR.value;

    switch (tok.type) {
      case TOKEN_LEFT_PAREN: {
        const r = parseFunCall(parserContext, tok, current);
        if (isErr(r)) { return r; }
        current = r.value;
        continue;
      }
      case TOKEN_LEFT_BRACKET: {
        const consumedR = nextToken(parserContext);
        if (isErr(consumedR)) { return consumedR; }
        const r = parseBracketAccess(parserContext, tok, current);
        if (isErr(r)) { return r; }
        current = r.value;
        continue;
      }
      case TOKEN_OPERATOR:
        if (tok.value === '.') {
          const r = parseDotAccess(parserContext, tok, current);
          if (isErr(r)) { return r; }
          current = r.value;
          continue;
        }
        if (tok.value === '?.') {
          const r = parseOptionalChain(parserContext, tok, current);
          if (isErr(r)) { return r; }
          current = r.value;
          continue;
        }
        if (tok.value === '++') {
          const consumedR = nextToken(parserContext);
          if (isErr(consumedR)) { return consumedR; }
          current = increment(loc(tok), { target: current, isPostfix: true });
          continue;
        }
        if (tok.value === '--') {
          const consumedR = nextToken(parserContext);
          if (isErr(consumedR)) { return consumedR; }
          current = decrement(loc(tok), { target: current, isPostfix: true });
          continue;
        }
        return ok(current);
      default:
        return ok(current);
    }
  }
};

export { parsePipeForward, parseFilterCallName, parseFilterCallArgs } from './pipe-forward.ts';
