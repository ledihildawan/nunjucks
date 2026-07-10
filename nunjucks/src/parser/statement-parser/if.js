import { If, IfAsync } from '../../nodes/index.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseIf = (ctx) => {
  const tag = peekToken(ctx);
  let node;

  if (skipSymbol(ctx, 'if') || skipSymbol(ctx, 'elif') || skipSymbol(ctx, 'elseif')) {
    node = new If(tag.lineno, tag.colno);
  } else if (skipSymbol(ctx, 'ifAsync')) {
    node = new IfAsync(tag.lineno, tag.colno);
  } else {
    fail(ctx, 'parseIf: expected if, elif, or elseif',
      tag.lineno,
      tag.colno);
  }

  node.cond = ctx.parseExpression();
  advanceAfterBlockEnd(ctx, tag.value);

  node.body = ctx.parseUntilBlocks('elif', 'elseif', 'else', 'endif');
  const tok = peekToken(ctx);

  switch (tok && tok.value) {
    case 'elseif':
    case 'elif':
      node.else_ = parseIf(ctx);
      break;
    case 'else':
      advanceAfterBlockEnd(ctx);
      node.else_ = ctx.parseUntilBlocks('endif');
      advanceAfterBlockEnd(ctx);
      break;
    case 'endif':
      node.else_ = null;
      advanceAfterBlockEnd(ctx);
      break;
    default:
      fail(ctx, 'parseIf: expected elif, else, or endif, got end of file');
  }

  return node;
};
