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
import { parsePrimary } from "../expression-parser/primary.ts";
import { parseExpression } from "../expression-parser/inline.ts";
import { parseUntilBlocks } from "../top-level.ts";
import { tryParsePattern } from "../node-parsers/pattern.ts";

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

const COMPOUND_OPS = ['||=', '&&=', '??=', '**=', '//='] as const;

const parseOperator = (ctx: ParserContext, tag: ReturnType<typeof peekToken>): string => {
  const tok = peekToken(ctx);
  if (tok && tok.type === TOKEN_OPERATOR) {
    if (COMPOUND_OPS.includes(tok.value as typeof COMPOUND_OPS[number])) {
      return nextToken(ctx).value as string;
    }
    if (tok.value === '=') {
      nextToken(ctx);
      return '=';
    }
    fail(ctx, 'Expected =, ||= , &&=, ??=, **=, //=', tag.lineno, tag.colno);
  }
  fail(ctx, 'Expected =', tag.lineno, tag.colno);
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

  const operator = parseOperator(ctx, tag);
  const value = parseExpression(ctx);

  if (operator !== '=') {
    return compoundAssignment(tag.lineno, tag.colno, { targets, operator, value });
  }

  return variableAssignment(tag.lineno, tag.colno, targets, value);
};

const isEndOfArgs = (tok: ReturnType<typeof peekToken>): boolean =>
  tok.type === TOKEN_RIGHT_PAREN;

const parseDefineArg = (ctx: ParserContext): { name: string; defaultVal: Node | null } => {
  const argTok = peekToken(ctx);
  if (argTok.type !== 'symbol') {
    fail(ctx, 'Expected argument name', argTok.lineno, argTok.colno);
  }
  const argName = nextToken(ctx).value as string;
  let defaultVal: Node | null = null;
  if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
    defaultVal = parseExpression(ctx);
  }
  return { name: argName, defaultVal };
};

const parseDefineArgs = (ctx: ParserContext): MacroArgument[] => {
  const args: MacroArgument[] = [];
  nextToken(ctx);
  for (;;) {
    const argTok = peekToken(ctx);
    if (isEndOfArgs(argTok)) {
      nextToken(ctx);
      break;
    }
    const { name, defaultVal } = parseDefineArg(ctx);
    args.push({ name, defaultVal });
    const afterArg = peekToken(ctx);
    if (afterArg.type === TOKEN_COMMA) {
      nextToken(ctx);
    } else if (afterArg.type === TOKEN_RIGHT_PAREN) {
      nextToken(ctx);
      break;
    } else {
      fail(ctx, 'Expected , or ) after argument', afterArg.lineno, afterArg.colno);
    }
  }
  return args;
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
    args.push(...parseDefineArgs(ctx));
  }

  advanceAfterBlockEnd(ctx, 'define');

  const body = parseUntilBlocks(ctx, 'enddefine');

  if (!skipSymbol(ctx, 'enddefine')) {
    fail(ctx, 'Expected enddefine', tag.lineno, tag.colno);
  }

  advanceAfterBlockEnd(ctx, 'enddefine');

  return defineBlock(tag.lineno, tag.colno, { name: nameTok.value as string, body, args });
};
