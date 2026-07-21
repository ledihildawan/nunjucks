import { nodes } from '@nunjucks/nodes';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { peekToken, nextToken } from "../cursor.ts";
import { parseAdd } from "./arithmetic.ts";

export const parseConcat = (ctx) => {
  let node = parseAdd(ctx);
  let tok = peekToken(ctx);
  while (tok && tok.type === TOKEN_OPERATOR && tok.value === '+') {
    nextToken(ctx);
    const node2 = parseAdd(ctx);
    node = nodes.concat(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};
