import * as lexer from '../lexer/index.js';
import {
  InlineIf,
  Or,
  NullishCoalesce,
  And,
  Not,
  In as OperatorIn,
  Is,
  Compare,
  CompareOperand,
  Concat,
  Add,
  Sub,
  Mul,
  Div,
  FloorDiv,
  Mod,
  Pow,
  Neg,
  Pos,
  Literal,
  Symbol as ASTSymbol,
} from '../nodes.js';
import { nextToken, peekToken, pushToken, skipValue, skipSymbol, fail } from './cursor.js';

export const parseExpression = (ctx) => parseInlineIf(ctx);

export const parseInlineIf = (ctx) => {
  let node = parseOr(ctx);
  if (skipSymbol(ctx, 'if')) {
    const condNode = parseOr(ctx);
    const bodyNode = node;
    node = new InlineIf(node.lineno, node.colno);
    node.body = bodyNode;
    node.cond = condNode;
    if (skipSymbol(ctx, 'else')) {
      node.else_ = parseOr(ctx);
    } else {
      node.else_ = null;
    }
  }
  return node;
};

export const parseOr = (ctx) => {
  let node = parseNullishCoalesce(ctx);
  while (skipSymbol(ctx, 'or')) {
    const node2 = parseNullishCoalesce(ctx);
    node = new Or(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseNullishCoalesce = (ctx) => {
  let node = parseAnd(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '??')) {
    const node2 = parseAnd(ctx);
    node = new NullishCoalesce(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseAnd = (ctx) => {
  let node = parseNot(ctx);
  while (skipSymbol(ctx, 'and')) {
    const node2 = parseNot(ctx);
    node = new And(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseNot = (ctx) => {
  const tok = peekToken(ctx);
  if (skipSymbol(ctx, 'not')) {
    return new Not(tok.lineno, tok.colno, parseNot(ctx));
  }
  return parseIn(ctx);
};

export const parseIn = (ctx) => {
  let node = parseIs(ctx);
  while (1) {
    const tok = nextToken(ctx);
    if (!tok) {
      break;
    }
    const invert = tok.type === lexer.TOKEN_SYMBOL && tok.value === 'not';
    if (!invert) {
      pushToken(ctx, tok);
    }
    if (skipSymbol(ctx, 'in')) {
      const node2 = parseIs(ctx);
      node = new OperatorIn(node.lineno, node.colno, node, node2);
      if (invert) {
        node = new Not(node.lineno, node.colno, node);
      }
    } else {
      if (invert) {
        pushToken(ctx, tok);
      }
      break;
    }
  }
  return node;
};

export const parseIs = (ctx) => {
  let node = parseCompare(ctx);
  if (skipSymbol(ctx, 'is')) {
    const not = skipSymbol(ctx, 'not');
    const node2 = parseCompare(ctx);
    node = new Is(node.lineno, node.colno, node, node2);
    if (not) {
      node = new Not(node.lineno, node.colno, node);
    }
  }
  return node;
};

export const parseCompare = (ctx) => {
  const compareOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];
  const expr = parseConcat(ctx);
  const ops = [];

  while (1) {
    const tok = nextToken(ctx);

    if (!tok) {
      break;
    } else if (compareOps.indexOf(tok.value) !== -1) {
      ops.push(new CompareOperand(tok.lineno, tok.colno, parseConcat(ctx), tok.value));
    } else {
      pushToken(ctx, tok);
      break;
    }
  }

  if (ops.length) {
    return new Compare(ops[0].lineno, ops[0].colno, expr, ops);
  } else {
    return expr;
  }
};

export const parseConcat = (ctx) => {
  let node = parseAdd(ctx);
  while (skipValue(ctx, lexer.TOKEN_TILDE, '~')) {
    const node2 = parseAdd(ctx);
    node = new Concat(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseAdd = (ctx) => {
  let node = parseSub(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '+')) {
    const node2 = parseSub(ctx);
    node = new Add(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseSub = (ctx) => {
  let node = parseMul(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '-')) {
    const node2 = parseMul(ctx);
    node = new Sub(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseMul = (ctx) => {
  let node = parseDiv(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '*')) {
    const node2 = parseDiv(ctx);
    node = new Mul(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseDiv = (ctx) => {
  let node = parseFloorDiv(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '/')) {
    const node2 = parseFloorDiv(ctx);
    node = new Div(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseFloorDiv = (ctx) => {
  let node = parseMod(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '//')) {
    const node2 = parseMod(ctx);
    node = new FloorDiv(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseMod = (ctx) => {
  let node = parsePow(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '%')) {
    const node2 = parsePow(ctx);
    node = new Mod(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parsePow = (ctx) => {
  let node = parseUnary(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '**')) {
    const node2 = parseUnary(ctx);
    node = new Pow(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseUnary = (ctx, noPipes) => {
  const tok = peekToken(ctx);
  let node;

  if (skipValue(ctx, lexer.TOKEN_OPERATOR, '-')) {
    node = new Neg(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, lexer.TOKEN_OPERATOR, '+')) {
    node = new Pos(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else {
    node = ctx.parsePrimary();
  }

  if (!noPipes) {
    node = ctx.parsePipe(node);
  }

  return node;
};
