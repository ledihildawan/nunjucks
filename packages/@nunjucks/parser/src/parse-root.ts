import type { TemplateError } from '@nunjucks/error-formatter';
import type { Delimiters, Token } from '@nunjucks/lexer';
import {
  TOKEN_BLOCK_START,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_RAW,
  TOKEN_VARIABLE_START,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { nodeList, output, templateData } from '@nunjucks/nodes';
import { loc, ZERO_LOC } from '@nunjucks/shared';
import { pipe } from 'remeda';
import type { ParserContext } from './cursor.ts';
import {
  advanceAfterVariableEnd,
  consumeWhitespaceDrop,
  fail,
  nextTokenOrNull,
  peekTokenOrNull,
} from './cursor.ts';
import { parseExpression } from './expression-parser/index.ts';
import { parseStatement } from './statement-parser/index.ts';

/**
 * Parses nodes until one of `blockNames` opens, returning them as a single
 * node list; the terminating tag itself is left unconsumed for the caller.
 */
const parseUntilBlocks = (
  parserContext: ParserContext,
  ...blockNames: string[]
): Result<Node, TemplateError> => {
  const nodesR = parseNodes(parserContext, blockNames);
  if (isErr(nodesR)) {
    return nodesR;
  }
  return ok(nodeList(ZERO_LOC, nodesR.value));
};

const LEADING_WHITESPACE_RE = /^\s*/;
const TRAILING_WHITESPACE_RE = /\s*$/;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface RawTagRegexes {
  open: RegExp;
  close: RegExp;
}

// WHY: raw tag texts are matched against the ACTIVE delimiters (custom block tags
// included) with the fixed dash strip forms as alternatives, so `{% raw -%}` and
// `{%- endraw %}` are recognized instead of leaking into the output.
const buildRawTagRegexes = (tags: Delimiters): RawTagRegexes => {
  const openStart = `(?:${escapeRegExp(tags.stripBlockStart)}|${escapeRegExp(tags.blockStart)})`;
  const closeEnd = `(?:${escapeRegExp(tags.stripBlockEnd)}|${escapeRegExp(tags.blockEnd)})`;
  return {
    open: new RegExp(`^${openStart}\\s*(?:raw|verbatim)\\s*${closeEnd}`),
    close: new RegExp(`${openStart}\\s*(?:endraw|endverbatim)\\s*${closeEnd}$`),
  };
};

// WHY: reads the lexer's canonical strip flags instead of string-sniffing the token
// value — index arithmetic against delimiter lengths broke for custom-length tags.
const shouldStripTrailingWhitespace = (nextTok: Token): boolean => {
  if (nextTok.type === TOKEN_BLOCK_START) {
    return nextTok.stripLeft === true;
  }
  if (nextTok.type === TOKEN_VARIABLE_START) {
    return nextTok.stripLeft === true;
  }
  if (nextTok.type === TOKEN_COMMENT) {
    return nextTok.stripLeft === true;
  }
  if (nextTok.type === TOKEN_RAW) {
    return nextTok.stripLeft === true;
  }
  return false;
};

const parseDataToken = (
  parserContext: ParserContext,
  tok: Token,
  { stripLeading }: { stripLeading: boolean }
): Node => {
  const nextTok = peekTokenOrNull(parserContext);
  const stripTrailing = Boolean(nextTok && shouldStripTrailingWhitespace(nextTok));
  const templateText = pipe(
    String(tok.value),
    (s) => (stripLeading ? s.replace(LEADING_WHITESPACE_RE, '') : s),
    (s) => (stripTrailing ? s.replace(TRAILING_WHITESPACE_RE, '') : s)
  );

  return output(loc(tok), [templateData(loc(tok), templateText)]);
};

const parseRawToken = (parserContext: ParserContext, tok: Token & { type: 'raw' }): Node => {
  const { open, close } = buildRawTagRegexes(parserContext.tokens.tags);
  const value = String(tok.value);
  const openTagText = value.match(open)?.[0] ?? '';
  const closeTagText = value.match(close)?.[0] ?? '';
  const contentEnd = closeTagText ? value.length - closeTagText.length : undefined;
  let content = openTagText ? value.slice(openTagText.length, contentEnd) : value;
  // WHY: strip markers on the raw tags themselves trim the ADJACENT raw content —
  // `-%}` on the open tag trims the content head, `{%-` on the close tag its tail.
  if (openTagText.endsWith(parserContext.tokens.tags.stripBlockEnd)) {
    content = content.replace(LEADING_WHITESPACE_RE, '');
  }
  if (closeTagText.startsWith(parserContext.tokens.tags.stripBlockStart)) {
    content = content.replace(TRAILING_WHITESPACE_RE, '');
  }
  return output(loc(tok), [templateData(loc(tok), content)]);
};

const parseVariableToken = (
  parserContext: ParserContext,
  tok: Token
): Result<Node, TemplateError> => {
  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) {
    return exprR;
  }
  const endR = advanceAfterVariableEnd(parserContext);
  if (isErr(endR)) {
    return endR;
  }
  return ok(output(loc(tok), [exprR.value]));
};

// WHY: reads the lexer's canonical strip flag so every strip decision flows from the
// same source of truth instead of per-site index arithmetic on the token value.
const parseCommentToken = (parserContext: ParserContext, tok: Token): void => {
  parserContext.dropLeadingWhitespace = tok.stripRight === true;
};

interface HandleTokenResult {
  continue: boolean;
  nodes: Node[];
}

const handleToken = (
  parserContext: ParserContext,
  tok: Token,
  breakOn: readonly string[] | null = null
): Result<HandleTokenResult, TemplateError> => {
  const wsDrop = consumeWhitespaceDrop(parserContext);

  if (tok.type === TOKEN_DATA) {
    const node = parseDataToken(parserContext, tok, { stripLeading: wsDrop });
    return ok({ continue: true, nodes: [node] });
  }
  if (tok.type === TOKEN_BLOCK_START) {
    const statementR = parseStatement(parserContext, breakOn);
    if (isErr(statementR)) {
      return statementR;
    }
    const statementNode = statementR.value;
    return ok({ continue: statementNode !== null, nodes: statementNode ? [statementNode] : [] });
  }
  if (tok.type === TOKEN_VARIABLE_START) {
    const nodeR = parseVariableToken(parserContext, tok);
    if (isErr(nodeR)) {
      return nodeR;
    }
    return ok({ continue: true, nodes: [nodeR.value] });
  }
  if (tok.type === TOKEN_COMMENT) {
    parseCommentToken(parserContext, tok);
    return ok({ continue: true, nodes: [] });
  }
  if (tok.type === TOKEN_RAW) {
    // WHY: a `-%}`-style close on endraw arms the drop for the data AFTER the block —
    // same contract as advanceAfterBlockEnd; the flag is assigned (clobbered) like the
    // original parser does at every block tag.
    parserContext.dropLeadingWhitespace = tok.stripRight === true;
    const node = parseRawToken(parserContext, tok);
    return ok({ continue: true, nodes: [node] });
  }
  return fail(parserContext, {
    message: `Unexpected token at top-level: ${tok.type}`,
    lineno: tok.lineno,
    colno: tok.colno,
  });
};

/**
 * Core node loop: dispatches each token (data, block, variable, comment,
 * raw) until end of input. When `breakOn` is non-null, an opening tag whose
 * name is listed stops the loop without consuming it, signalling an
 * enclosing statement parser.
 */
const parseNodes = (
  parserContext: ParserContext,
  breakOn: readonly string[] | null = null
): Result<Node[], TemplateError> => {
  // WHY: mutable accumulator (parser loop exemption) — spreading per token is O(n²) on large templates.
  const collectedNodes: Node[] = [];

  const parseLoop = (): Result<Node[], TemplateError> => {
    while (true) {
      const tok = nextTokenOrNull(parserContext);
      if (!tok) {
        return ok(collectedNodes);
      }
      const resultR = handleToken(parserContext, tok, breakOn);
      if (isErr(resultR)) {
        return resultR;
      }
      const result = resultR.value;
      if (!result.continue) {
        return ok(collectedNodes);
      }
      collectedNodes.push(...result.nodes);
    }
  };

  return parseLoop();
};

export { parseNodes, parseUntilBlocks };
