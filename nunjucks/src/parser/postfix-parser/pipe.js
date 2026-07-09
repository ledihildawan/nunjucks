import * as lexer from '../../lexer/index.js';
import { Symbol as ASTSymbol, Pipe, NodeList } from '../../nodes.js';
import { peekToken, skip, skipValue, expect } from '../cursor.js';

export const parseFilterName = (ctx) => {
  const tok = expect(ctx, lexer.TOKEN_SYMBOL);
  let name = tok.value;

  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '.')) {
    name += '.' + expect(ctx, lexer.TOKEN_SYMBOL).value;
  }

  return new ASTSymbol(tok.lineno, tok.colno, name);
};

export const parseFilterArgs = (ctx, node) => {
  if (peekToken(ctx).type === lexer.TOKEN_LEFT_PAREN) {
    const call = ctx.parsePostfix(node);
    return call.args.children;
  }
  return [];
};

export const parsePipe = (ctx, node) => {
  while (skip(ctx, lexer.TOKEN_PIPEFORWARD)) {
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
