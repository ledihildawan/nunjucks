import { Capture, Filter, NodeList, Output } from '../../nodes/index.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseFilterStatement = (ctx) => {
  const filterTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'filter')) {
    fail(ctx, 'parseFilterStatement: expected filter');
  }

  const name = ctx.parseFilterName();
  const args = ctx.parseFilterArgs(name);

  advanceAfterBlockEnd(ctx, filterTok.value);
  const body = Capture(
    name.lineno,
    name.colno,
    ctx.parseUntilBlocks('endfilter')
  );
  advanceAfterBlockEnd(ctx);

  const node = Filter(
    name.lineno,
    name.colno,
    name,
    NodeList(
      name.lineno,
      name.colno,
      [body].concat(args)
    )
  );

  return Output(
    name.lineno,
    name.colno,
    [node]
  );
};
