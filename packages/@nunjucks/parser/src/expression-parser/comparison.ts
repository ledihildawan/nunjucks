import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_SYMBOL,
  TOKEN_NONE,
  TOKEN_BOOLEAN,
  TOKEN_LEFT_PAREN,
  isTestKeyword,
} from '@nunjucks/lexer';
import {
  compare,
  compareOperand,
  in_,
  is,
  not,
  test,
  testCall,
  bitwiseOr,
  bitwiseAnd,
  bitwiseXor,
  bitwiseLShift,
  bitwiseRShift,
} from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, peekToken, pushToken, skipSymbol } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { parseSignature } from '../node-parser/signature.ts';
import type { BinNodeFn } from './internal.ts';
import { parseConcat } from './arithmetic.ts';

const COMPARE_OPS = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];

const parseCompare = (ctx: ParserContext): Node => {
  const expr = parseConcat(ctx);
  const ops: Node[] = [];

  for (;;) {
    const tok = nextToken(ctx);

    if (!tok) {
      break;
    }
    if (COMPARE_OPS.includes(String(tok.value))) {
      ops.push(compareOperand(tok.lineno, tok.colno, parseConcat(ctx), String(tok.value)));
    } else {
      pushToken(ctx, tok);
      break;
    }
  }

  const [firstOp] = ops;
  if (firstOp) {
    return compare(firstOp.lineno, firstOp.colno, expr, ops);
  }
  return expr;
};

const detectTestName = (testTok: Token): string | null => {
  if (testTok.type === TOKEN_SYMBOL && isTestKeyword(String(testTok.value))) {
    return String(testTok.value);
  }
  if (testTok.type === TOKEN_NONE && isTestKeyword('null')) {
    return 'null';
  }
  if (testTok.type === TOKEN_BOOLEAN && isTestKeyword(String(testTok.value))) {
    return String(testTok.value);
  }
  return null;
};

const parseTestArgs = (ctx: ParserContext): readonly Node[] => {
  if (peekToken(ctx).type !== TOKEN_LEFT_PAREN) {
    return [];
  }
  const sig = parseSignature(ctx);
  if (sig && 'children' in sig) {
    return (sig as { children: readonly Node[] }).children;
  }
  return [];
};

const parseIs = (ctx: ParserContext): Node => {
  const initialNode = parseCompare(ctx);
  const tok = peekToken(ctx);
  if (!skipSymbol(ctx, 'is')) {
    return initialNode;
  }
  const negate = skipSymbol(ctx, 'not');

  const testTok = peekToken(ctx);
  const testName = detectTestName(testTok);

  if (testName) {
    nextToken(ctx);
    const testArgs = parseTestArgs(ctx);
    const lineno = tok.lineno;
    const colno = tok.colno;

    const testNode = testArgs.length > 0
      ? testCall(lineno, colno, { target: initialNode, name: testName, args: testArgs })
      : test(lineno, colno, initialNode, testName);

    return negate ? not(tok.lineno, tok.colno, testNode) : testNode;
  }

  const node2 = parseCompare(ctx);
  const isNode = is(tok.lineno, tok.colno, initialNode, node2);
  return negate ? not(tok.lineno, tok.colno, isNode) : isNode;
};

const bitwiseNodeMap: Record<string, BinNodeFn> = {
  '|': bitwiseOr,
  '&': bitwiseAnd,
  '^': bitwiseXor,
  '<<': bitwiseLShift,
  '>>': bitwiseRShift
};

const parseBitwiseOr = (ctx: ParserContext): Node => {
  const initialNode = parseIs(ctx);
  const tok = nextToken(ctx);

  if (!tok) {
    return initialNode;
  }

  const createNode = bitwiseNodeMap[String(tok.value)];
  if (!createNode) {
    pushToken(ctx, tok);
    return initialNode;
  }

  const right = parseIs(ctx);
  return createNode(tok.lineno, tok.colno, initialNode, right);
};

const isInToken = (tok: Token): boolean =>
  tok?.type === TOKEN_SYMBOL && tok?.value === 'in';

const isNotInversion = (tok: Token): boolean =>
  tok?.type === TOKEN_SYMBOL && tok?.value === 'not';

const handleInExpression = (ctx: ParserContext, node: Node, invert: boolean, inTok: Token): Node => {
  const node2 = parseIs(ctx);
  const newNode = in_(inTok.lineno, inTok.colno, node, node2);
  return invert ? not(inTok.lineno, inTok.colno, newNode) : newNode;
};

const processInToken = (ctx: ParserContext, node: Node, invert: boolean, inTok: Token): Node | null => {
  if (isInToken(inTok)) {
    return parseInLoop(ctx, handleInExpression(ctx, node, invert, inTok));
  }
  if (inTok) { pushToken(ctx, inTok); }
  return null;
};

const parseInLoop = (ctx: ParserContext, node: Node): Node => {
  const tok = nextToken(ctx);
  if (!tok) { return node; }

  const invert = isNotInversion(tok);
  if (!invert && !isInToken(tok)) {
    pushToken(ctx, tok);
    return node;
  }

  const inTok = invert ? nextToken(ctx) : tok;
  const result = processInToken(ctx, node, invert, inTok);
  return result ?? node;
};

const parseIn = (ctx: ParserContext): Node => {
  const node = parseBitwiseOr(ctx);
  return parseInLoop(ctx, node);
};

export { parseIn };
