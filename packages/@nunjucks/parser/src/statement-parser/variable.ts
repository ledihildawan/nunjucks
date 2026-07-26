import {
  TOKEN_COMMA,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_OPERATOR,
} from '@nunjucks/lexer';
import { compoundAssignment, defineBlock, variableAssignment, variableDeclaration } from '@nunjucks/nodes';
import type { MacroArgument, Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skipValue, nextToken, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../top-level.ts";
import { tryParsePattern } from "../node-parsers/index.ts";

export const parseVariableDeclaration = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);

  const patternNode = tryParsePattern(ctx);
  const targets: Node[] = [];

  if (patternNode) {
    targets.push(patternNode);
  } else {
    const target = parsePrimary(ctx);
    if (!target || (target.type !== 'symbol' && !target.value)) {
      fail(ctx, 'Expected variable name or pattern', tag.lineno, tag.colno);
    }
    targets.push(target);
  }

  if (!skipValue(ctx, TOKEN_OPERATOR, ':=')) {
    fail(ctx, 'Expected :=', tag.lineno, tag.colno);
  }

  const value = parseExpression(ctx);

  return variableDeclaration(tag.lineno, tag.colno, targets, value);
};

export const parseVariableAssignment = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);

  const patternNode = tryParsePattern(ctx);
  const targets: Node[] = [];

  if (patternNode) {
    targets.push(patternNode);
  } else {
    const target = parsePrimary(ctx);
    if (!target || (target.type !== 'symbol' && !target.value)) {
      fail(ctx, 'Expected variable name or pattern', tag.lineno, tag.colno);
    }
    targets.push(target);
  }

  const compoundOps = ['||=', '&&=', '??=', '**=', '//='];
  let operator = '=';

  const tok = peekToken(ctx);
  if (tok && tok.type === TOKEN_OPERATOR) {
    if (compoundOps.includes(tok.value as string)) {
      operator = nextToken(ctx).value as string;
    } else if (tok.value === '=') {
      nextToken(ctx);
    } else {
      fail(ctx, 'Expected =, ||= , &&=, ??=, **=, //=', tag.lineno, tag.colno);
    }
  } else {
    fail(ctx, 'Expected =', tag.lineno, tag.colno);
  }

  const value = parseExpression(ctx);

  if (operator !== '=') {
    return compoundAssignment(tag.lineno, tag.colno, targets, operator, value);
  }

  return variableAssignment(tag.lineno, tag.colno, targets, value);
};

export const parseDefineBlock = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);

  if (!skipSymbol(ctx, 'define')) {
    fail(ctx, 'Expected define', tag.lineno, tag.colno);
  }

  const nameTok = parsePrimary(ctx, true);
  if (!nameTok || (nameTok.type !== 'symbol' && !nameTok.value)) {
    fail(ctx, 'Expected block name', tag.lineno, tag.colno);
  }

  const args: MacroArgument[] = [];
  const tok = peekToken(ctx);
  if (tok && tok.type === TOKEN_LEFT_PAREN) {
    nextToken(ctx);
    while (true) {
      const argTok = peekToken(ctx);
      if (argTok.type === TOKEN_RIGHT_PAREN) {
        nextToken(ctx);
        break;
      }
      if (argTok.type === 'symbol') {
        const argName = nextToken(ctx).value as string;
        let defaultVal: Node | null = null;
        if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
          defaultVal = parseExpression(ctx);
        }
        args.push({ name: argName, defaultVal });
        const afterArg = peekToken(ctx);
        if (afterArg.type === TOKEN_COMMA) {
          nextToken(ctx);
        } else if (afterArg.type === TOKEN_RIGHT_PAREN) {
          nextToken(ctx);
          break;
        } else {
          fail(ctx, 'Expected , or ) after argument', afterArg.lineno, afterArg.colno);
        }
      } else {
        fail(ctx, 'Expected argument name', argTok.lineno, argTok.colno);
      }
    }
  }

  advanceAfterBlockEnd(ctx, 'define');

  const body = parseUntilBlocks(ctx, 'enddefine');

  if (!skipSymbol(ctx, 'enddefine')) {
    fail(ctx, 'Expected enddefine', tag.lineno, tag.colno);
  }

  advanceAfterBlockEnd(ctx, 'enddefine');

  return defineBlock(tag.lineno, tag.colno, nameTok.value as string, body, args);
};
