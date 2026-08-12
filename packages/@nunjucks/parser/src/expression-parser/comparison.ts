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
import type { TemplateError } from '@nunjucks/error-formatter';
import { nextToken, peekToken, pushToken, skipSymbol } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseSignature } from '../node-parser/signature.ts';
import type { BinNodeFn } from './binary-helpers.ts';
import { parseConcat } from './arithmetic.ts';
import { loc } from '@nunjucks/lexer';

const COMPARE_OPS = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];

const parseCompare = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const exprR = parseConcat(parserContext);
  if (isErr(exprR)) { return exprR; }
  const expr = exprR.value;
  const ops: Node[] = [];

  const parseLoop = (): Result<void, TemplateError> => {
    const tokR = nextToken(parserContext);
    if (isErr(tokR)) { return tokR; }
    const tok = tokR.value;

    if (COMPARE_OPS.includes(String(tok.value))) {
      const operandR = parseConcat(parserContext);
      if (isErr(operandR)) { return operandR; }
      ops.push(compareOperand(loc(tok), { expr: operandR.value, operator: String(tok.value) }));
      return parseLoop();
    }
    pushToken(parserContext, tok);
    return ok(undefined);
  };

  const loopR = parseLoop();
  if (isErr(loopR)) { return loopR; }

  const [firstOp] = ops;
  if (firstOp) {
    return ok(compare(loc(firstOp), { expr, ops }));
  }
  return ok(expr);
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

const parseTestArgs = (parserContext: ParserContext): Result<readonly Node[], TemplateError> => {
  const peekR = peekToken(parserContext);
  if (isErr(peekR)) { return peekR; }
  if (peekR.value.type !== TOKEN_LEFT_PAREN) {
    return ok([]);
  }
  const sigR = parseSignature({ parserContext });
  if (isErr(sigR)) { return sigR; }
  const sig = sigR.value;
  if (sig && 'children' in sig) {
    return ok((sig as { children: readonly Node[] }).children);
  }
  return ok([]);
};

const parseIs = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const initialR = parseCompare(parserContext);
  if (isErr(initialR)) { return initialR; }
  const initialNode = initialR.value;
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  if (!skipSymbol(parserContext, 'is')) {
    return ok(initialNode);
  }
  const negate = skipSymbol(parserContext, 'not');

  const testTokR = peekToken(parserContext);
  if (isErr(testTokR)) { return testTokR; }
  const testTok = testTokR.value;
  const testName = detectTestName(testTok);

  if (testName) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    const argsR = parseTestArgs(parserContext);
    if (isErr(argsR)) { return argsR; }
    const testArgs = argsR.value;
    const origin = loc(tok);

    const builtTest = testArgs.length > 0
      ? testCallNode(origin, { target: initialNode, name: testName, args: testArgs })
      : testNode(origin, { target: initialNode, name: testName });

    return ok(negate ? not(loc(tok), builtTest) : builtTest);
  }

  const rightOperandR = parseCompare(parserContext);
  if (isErr(rightOperandR)) { return rightOperandR; }
  const builtIs = isOp(loc(tok), { left: initialNode, right: rightOperandR.value });
  return ok(negate ? not(loc(tok), builtIs) : builtIs);
};

const bitwiseNodeMap: Record<string, BinNodeFn> = {
  '|': bitwiseOr,
  '&': bitwiseAnd,
  '^': bitwiseXor,
  '<<': bitwiseLShift,
  '>>': bitwiseRShift
};

const parseBitwiseOr = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const initialR = parseIs(parserContext);
  if (isErr(initialR)) { return initialR; }
  const initialNode = initialR.value;
  const tokR = nextToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  const createNode = bitwiseNodeMap[String(tok.value)];
  if (!createNode) {
    pushToken(parserContext, tok);
    return ok(initialNode);
  }

  const rightR = parseIs(parserContext);
  if (isErr(rightR)) { return rightR; }
  return ok(createNode(loc(tok), { left: initialNode, right: rightR.value }));
};

const isInToken = (tok: Token): boolean =>
  tok?.type === TOKEN_SYMBOL && tok?.value === 'in';

const isNotInversion = (tok: Token): boolean =>
  tok?.type === TOKEN_SYMBOL && tok?.value === 'not';

interface HandleInExpressionOptions {
  parserContext: ParserContext;
  node: Node;
  invert: boolean;
  inTok: Token;
}

const handleInExpression = ({ parserContext, node, invert, inTok }: HandleInExpressionOptions): Result<Node, TemplateError> => {
  const rightOperandR = parseIs(parserContext);
  if (isErr(rightOperandR)) { return rightOperandR; }
  const newNode = inNode(loc(inTok), { left: node, right: rightOperandR.value });
  return ok(invert ? not(loc(inTok), newNode) : newNode);
};

interface ProcessInTokenOptions {
  parserContext: ParserContext;
  node: Node;
  invert: boolean;
  inTok: Token;
}

const processInToken = ({ parserContext, node, invert, inTok }: ProcessInTokenOptions): Result<Node | null, TemplateError> => {
  if (isInToken(inTok)) {
    const handledR = handleInExpression({ parserContext, node, invert, inTok });
    if (isErr(handledR)) { return handledR; }
    return parseInLoop(parserContext, handledR.value);
  }
  pushToken(parserContext, inTok);
  return ok(null);
};

const parseInLoop = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  const tokR = nextToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  const invert = isNotInversion(tok);
  if (!invert && !isInToken(tok)) {
    pushToken(parserContext, tok);
    return ok(node);
  }

  let inTok: Token;
  if (invert) {
    const inTokR = nextToken(parserContext);
    if (isErr(inTokR)) { return inTokR; }
    inTok = inTokR.value;
  } else {
    inTok = tok;
  }
  const resultR = processInToken({ parserContext, node, invert, inTok });
  if (isErr(resultR)) { return resultR; }
  return ok(resultR.value ?? node);
};

const parseIn = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const nodeR = parseBitwiseOr(parserContext);
  if (isErr(nodeR)) { return nodeR; }
  return parseInLoop(parserContext, nodeR.value);
};

export { parseIn };
