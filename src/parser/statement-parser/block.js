import { nodes } from '../../nodes/index.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseBlock = (ctx) => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'block')) {
    fail(ctx, 'parseBlock: expected block', tag.lineno, tag.colno);
  }

  const node = nodes.block(tag.lineno, tag.colno);

  node.name = ctx.parsePrimary();
  if (!nodes.isSymbol(node.name)) {
    fail(ctx, 'parseBlock: variable name expected',
      tag.lineno,
      tag.colno);
  }

  advanceAfterBlockEnd(ctx, tag.value);

  node.body = ctx.parseUntilBlocks('endblock');
  skipSymbol(ctx, 'endblock');
  skipSymbol(ctx, node.name.value);

  const tok = peekToken(ctx);
  if (!tok) {
    fail(ctx, 'parseBlock: expected endblock, got end of file');
  }

  advanceAfterBlockEnd(ctx, tok.value);

  return node;
};
