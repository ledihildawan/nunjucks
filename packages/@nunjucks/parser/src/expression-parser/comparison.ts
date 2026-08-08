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
  inNode,
  isOp,
  not,
  testNode,
  testCallNode,
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
import type { BinNodeFn } from './binary-helpers.ts';
import { parseConcat } from './arithmetic.ts';
import { loc } from '@nunjucks/shared';

const COMPARE_OPS = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];

const parseCompare = (parserContext: ParserContext): Node => {
  const expr = parseConcat(parserContext);
  const ops: Node[] = [];

  for (;;) {
    const tok = nextToken(parserContext);

    if (!tok) {
      break;
    }
    if (COMPARE_OPS.includes(String(tok.value))) {
      ops.push(compareOperand(loc(tok), { expr: parseConcat(parserContext), operator: String(tok.value) }));
    } else {
      pushToken(parserContext, tok);
      break;
    }
  }

  const [firstOp] = ops;
  if (firstOp) {
    return compare(loc(firstOp), { expr, ops });
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

const parseTestArgs = (parserContext: ParserContext): readonly Node[] => {
  if (peekToken(parserContext).type !== TOKEN_LEFT_PAREN) {
    return [];
  }
  const sig = parseSignature(parserContext);
  if (sig && 'children' in sig) {
    return (sig as { children: readonly Node[] }).children;
  }
  return [];
};

const parseIs = (parserContext: ParserContext): Node => {
  const initialNode = parseCompare(parserContext);
  const tok = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'is')) {
    return initialNode;
  }
  const negate = skipSymbol(parserContext, 'not');

  const testTok = peekToken(parserContext);
  const testName = detectTestName(testTok);

  if (testName) {
    nextToken(parserContext);
    const testArgs = parseTestArgs(parserContext);
    const origin = loc(tok);

    const builtTest = testArgs.length > 0
      ? testCallNode(origin, { target: initialNode, name: testName, args: testArgs })
      : testNode(origin, { target: initialNode, name: testName });

    return negate ? not(loc(tok), builtTest) : builtTest;
  }

  const node2 = parseCompare(parserContext);
  const builtIs = isOp(loc(tok), { left: initialNode, right: node2 });
  return negate ? not(loc(tok), builtIs) : builtIs;
};

const bitwiseNodeMap: Record<string, BinNodeFn> = {
  '|': bitwiseOr,
  '&': bitwiseAnd,
  '^': bitwiseXor,
  '<<': bitwiseLShift,
  '>>': bitwiseRShift
};

const parseBitwiseOr = (parserContext: ParserContext): Node => {
  const initialNode = parseIs(parserContext);
  const tok = nextToken(parserContext);

  if (!tok) {
    return initialNode;
  }

  const createNode = bitwiseNodeMap[String(tok.value)];
  if (!createNode) {
    pushToken(parserContext, tok);
    return initialNode;
  }

  const right = parseIs(parserContext);
  return createNode(loc(tok), { left: initialNode, right });
};

const isInToken = (tok: Token): boolean =>
  tok?.type === TOKEN_SYMBOL && tok?.value === 'in';

const isNotInversion = (tok: Token): boolean =>
  tok?.type === TOKEN_SYMBOL && tok?.value === 'not';

const handleInExpression = (parserContext: ParserContext, node: Node, invert: boolean, inTok: Token): Node => {
  const node2 = parseIs(parserContext);
  const newNode = inNode(loc(inTok), { left: node, right: node2 });
  return invert ? not(loc(inTok), newNode) : newNode;
};

const processInToken = (parserContext: ParserContext, node: Node, invert: boolean, inTok: Token): Node | null => {
  if (isInToken(inTok)) {
    return parseInLoop(parserContext, handleInExpression(parserContext, node, invert, inTok));
  }
  if (inTok) { pushToken(parserContext, inTok); }
  return null;
};

const parseInLoop = (parserContext: ParserContext, node: Node): Node => {
  const tok = nextToken(parserContext);
  if (!tok) { return node; }

  const invert = isNotInversion(tok);
  if (!invert && !isInToken(tok)) {
    pushToken(parserContext, tok);
    return node;
  }

  const inTok = invert ? nextToken(parserContext) : tok;
  const result = processInToken(parserContext, node, invert, inTok);
  return result ?? node;
};

const parseIn = (parserContext: ParserContext): Node => {
  const node = parseBitwiseOr(parserContext);
  return parseInLoop(parserContext, node);
};

export { parseIn };
