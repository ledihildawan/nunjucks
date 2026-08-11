import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_BLOCK_START,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_VARIABLE_START,
  TOKEN_RAW,
} from '@nunjucks/lexer';
import { nodeList, output, templateData } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { pipe } from 'remeda';
import { replace } from '@nunjucks/lib';
import { loc, ZERO_LOC } from '@nunjucks/shared';
import { ok, isErr, type Result } from '@nunjucks/lib';
import {
  nextTokenOrNull,
  peekTokenOrNull,
  advanceAfterVariableEnd,
  consumeWhitespaceDrop,
  fail,
} from "./cursor.ts";
import type { ParserContext } from "./cursor.ts";
import { parseStatement } from "./statement-parser/index.ts";
import { parseExpression } from "./expression-parser/index.ts";

const parseUntilBlocks = (parserContext: ParserContext, ...blockNames: string[]): Result<Node, TemplateError> => {
  const nodesR = parseNodes(parserContext, blockNames);
  if (isErr(nodesR)) { return nodesR; }
  return ok(nodeList(ZERO_LOC, nodesR.value));
};

const LEADING_WHITESPACE_RE = /^\s*/;
const TRAILING_WHITESPACE_RE = /\s*$/;
const RAW_OPEN_TAG_RE = /^({%\s*raw\s*%})/;
const RAW_CLOSE_TAG_RE = /({%\s*endraw\s*%})$/;

const shouldStripTrailingWhitespace = (
  nextTok: Token,
  parserContext: ParserContext
): boolean => {
  if (!nextTok) { return false; }
  const nextVal = String(nextTok.value);
  if (nextTok.type === TOKEN_BLOCK_START) {
    return nextVal.at(-1) === '-';
  }
  if (nextTok.type === TOKEN_VARIABLE_START) {
    return nextVal[parserContext.tokens.tags.variableStart.length] === '-';
  }
  if (nextTok.type === TOKEN_COMMENT) {
    return nextVal[parserContext.tokens.tags.commentStart.length] === '-';
  }
  return false;
};

const parseDataToken = (parserContext: ParserContext, tok: Token, stripLeading: boolean): Node => {
  const nextTok = peekTokenOrNull(parserContext);
  const stripTrailing = Boolean(nextTok && shouldStripTrailingWhitespace(nextTok, parserContext));
  const data = pipe(
    String(tok.value),
    s => (stripLeading ? s.replace(LEADING_WHITESPACE_RE, '') : s),
    s => (stripTrailing ? s.replace(TRAILING_WHITESPACE_RE, '') : s),
  );

  return output(
    loc(tok),
    [templateData(loc(tok), data)]
  );
};

const parseRawToken = (tok: Token & { type: 'raw' }): Node => {
  const content = pipe(tok.value, replace(RAW_OPEN_TAG_RE, ''), replace(RAW_CLOSE_TAG_RE, ''));
  return output(
    loc(tok),
    [templateData(loc(tok), content)]
  );
};

const parseVariableToken = (parserContext: ParserContext, tok: Token): Result<Node, TemplateError> => {
  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) { return exprR; }
  const endR = advanceAfterVariableEnd(parserContext);
  if (isErr(endR)) { return endR; }
  return ok(output(loc(tok), [exprR.value]));
};

const parseCommentToken = (parserContext: ParserContext, tok: Token): void => {
  const tokVal = String(tok.value);
  parserContext.dropLeadingWhitespace = tokVal.at(
    tokVal.length - parserContext.tokens.tags.commentEnd.length - 1
  ) === '-';
};

interface HandleTokenResult {
  continue: boolean;
  nodes: Node[];
}

const handleToken = (parserContext: ParserContext, tok: Token, breakOn: readonly string[] | null = null): Result<HandleTokenResult, TemplateError> => {
  const wsDrop = consumeWhitespaceDrop(parserContext);

  if (tok.type === TOKEN_DATA) {
    const node = parseDataToken(parserContext, tok, wsDrop);
    return ok({ continue: true, nodes: [node] });
  }
  if (tok.type === TOKEN_BLOCK_START) {
    const nR = parseStatement(parserContext, breakOn);
    if (isErr(nR)) { return nR; }
    const n = nR.value;
    return ok({ continue: n !== null, nodes: n ? [n] : [] });
  }
  if (tok.type === TOKEN_VARIABLE_START) {
    const nodeR = parseVariableToken(parserContext, tok);
    if (isErr(nodeR)) { return nodeR; }
    return ok({ continue: true, nodes: [nodeR.value] });
  }
  if (tok.type === TOKEN_COMMENT) {
    parseCommentToken(parserContext, tok);
    return ok({ continue: true, nodes: [] });
  }
  if (tok.type === TOKEN_RAW) {
    const node = parseRawToken(tok);
    return ok({ continue: true, nodes: [node] });
  }
  return fail(parserContext, `Unexpected token at top-level: ${tok.type}`, { lineno: tok.lineno, colno: tok.colno });
};

const parseNodes = (parserContext: ParserContext, breakOn: readonly string[] | null = null): Result<Node[], TemplateError> => {
  let nodes: Node[] = [];

  const parseLoop = (): Result<Node[], TemplateError> => {
    while (true) {
      const tok = nextTokenOrNull(parserContext);
      if (!tok) { return ok(nodes); }
      const resultR = handleToken(parserContext, tok, breakOn);
      if (isErr(resultR)) { return resultR; }
      const result = resultR.value;
      if (!result.continue) { return ok(nodes); }
      nodes = [...nodes, ...result.nodes];
    }
  };

  return parseLoop();
};

export { parseUntilBlocks, parseNodes };
