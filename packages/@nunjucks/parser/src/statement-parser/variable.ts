import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_OPERATOR,
} from '@nunjucks/lexer';
import { nodes } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skip, skipValue, nextToken, advanceAfterBlockEnd, fail } from "../cursor.ts";
import { tryParsePattern } from "../node-parsers/index.ts";

export const parseVariableDeclaration = (ctx) => {
  const tag = peekToken(ctx);

  const patternNode = tryParsePattern(ctx);
  let targets = [];

  if (patternNode) {
    targets.push(patternNode);
  } else {
    const target = ctx.parsePrimary();
    if (!target || (target.type !== 'symbol' && !target.value)) {
      fail(ctx, 'Expected variable name or pattern', tag.lineno, tag.colno);
    }
    targets.push(target);
  }

  if (!skipValue(ctx, TOKEN_OPERATOR, ':=')) {
    fail(ctx, 'Expected :=', tag.lineno, tag.colno);
  }

  const value = ctx.parseExpression();

  return nodes.variableDeclaration(tag.lineno, tag.colno, targets, value);
};

export const parseVariableAssignment = (ctx) => {
  const tag = peekToken(ctx);

  const patternNode = tryParsePattern(ctx);
  let targets = [];

  if (patternNode) {
    targets.push(patternNode);
  } else {
    const target = ctx.parsePrimary();
    if (!target || (target.type !== 'symbol' && !target.value)) {
      fail(ctx, 'Expected variable name or pattern', tag.lineno, tag.colno);
    }
    targets.push(target);
  }

  const compoundOps = ['||=', '&&=', '??=', '**=', '//='];
  let operator = '=';

  const tok = peekToken(ctx);
  if (tok && tok.type === TOKEN_OPERATOR) {
    if (compoundOps.includes(tok.value)) {
      operator = nextToken(ctx).value;
    } else if (tok.value === '=') {
      nextToken(ctx);
    } else {
      fail(ctx, 'Expected =, ||= , &&=, ??=, **=, //=', tag.lineno, tag.colno);
    }
  } else {
    fail(ctx, 'Expected =', tag.lineno, tag.colno);
  }

  const value = ctx.parseExpression();

  if (operator !== '=') {
    return nodes.compoundAssignment(tag.lineno, tag.colno, targets, operator, value);
  }

  return nodes.variableAssignment(tag.lineno, tag.colno, targets, value);
};

export const parseDefineBlock = (ctx) => {
  const tag = peekToken(ctx);

  if (!skipSymbol(ctx, 'define')) {
    fail(ctx, 'Expected define', tag.lineno, tag.colno);
  }

  const nameTok = ctx.parsePrimary(true);
  if (!nameTok || (nameTok.type !== 'symbol' && !nameTok.value)) {
    fail(ctx, 'Expected block name', tag.lineno, tag.colno);
  }

  const args = [];
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
        const argName = nextToken(ctx).value;
        let defaultVal = null;
        if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
          defaultVal = ctx.parseExpression();
        }
        args.push({ name: argName, defaultVal });
        const afterArg = peekToken(ctx);
        if (afterArg.type === TOKEN_COMMA) {
          nextToken(ctx);
          continue;
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

  const body = ctx.parseUntilBlocks('enddefine');

  if (!skipSymbol(ctx, 'enddefine')) {
    fail(ctx, 'Expected enddefine', tag.lineno, tag.colno);
  }

  advanceAfterBlockEnd(ctx, 'enddefine');

  return nodes.defineBlock(tag.lineno, tag.colno, nameTok.value || nameTok, body, args);
};