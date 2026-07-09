import {
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_LEFT_PAREN,
  TOKEN_SYMBOL,
} from '../../lexer/token-types.js';
import { AstSymbol, Pipe, NodeList } from '../../nodes.js';
import { peekToken, skip, skipValue, expect } from '../cursor.js';

export const parseFilterName = (ctx) => {
  const tok = expect(ctx, TOKEN_SYMBOL);
  let name = tok.value;

  while (skipValue(ctx, TOKEN_OPERATOR, '.')) {
    name += '.' + expect(ctx, TOKEN_SYMBOL).value;
  }

  return new AstSymbol(tok.lineno, tok.colno, name);
};

export const parseFilterArgs = (ctx, node) => {
  if (peekToken(ctx).type === TOKEN_LEFT_PAREN) {
    const call = ctx.parsePostfix(node);
    return call.args.children;
  }
  return [];
};

export const parsePipe = (ctx, node) => {
  while (skip(ctx, TOKEN_PIPEFORWARD)) {
    const name = parseFilterName(ctx);

    node = new Pipe(
      name.lineno,
      name.colno,
      name,
      new NodeList(
        name.lineno,
        name.colno,
        [node].concat(parseFilterArgs(ctx, node))
      )
    );
  }

  return node;
};
