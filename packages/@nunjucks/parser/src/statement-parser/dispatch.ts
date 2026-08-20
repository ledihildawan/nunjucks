import type { TemplateError } from '@nunjucks/error-formatter';
import {
  TOKEN_BLOCK_END,
  TOKEN_BLOCK_START,
  TOKEN_BOOLEAN,
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_FLOAT,
  TOKEN_INT,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
  TOKEN_NONE,
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_REGEX,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_RIGHT_PAREN,
  TOKEN_STRING,
  TOKEN_SYMBOL,
  TOKEN_TILDE,
  TOKEN_VARIABLE_END,
  TOKEN_VARIABLE_START,
  TOKEN_WHITESPACE,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { nodes } from '@nunjucks/nodes';
import { find } from 'remeda';
import type { ParserContext } from '../cursor.ts';
import { fail, peekToken } from '../cursor.ts';
import { STATEMENT_PARSERS } from './registry.ts';

/**
 * Dispatches the peeked tag symbol to its statement parser. Returns
 * `Ok(null)` — without consuming the tag — when it names an enclosing
 * `breakOn` delimiter; unknown tags fall back to extensions before
 * failing as `unknown block tag`.
 */
export const parseStatement = (
  parserContext: ParserContext,
  breakOn: readonly string[] | null = null
): Result<Node | null, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;

  if (tok.type !== TOKEN_SYMBOL) {
    return fail(parserContext, {
      message: 'tag name expected',
      lineno: tok.lineno,
      colno: tok.colno,
    });
  }

  // WHY: Set membership is O(1) vs O(N) array.includes for arbitrary breakOn sizes.
  // Static breakOn sets from callers are typically small; the Set normalizes both paths.
  if (breakOn && new Set(breakOn).has(String(tok.value))) {
    return ok(null);
  }

  const tagName = tok.value;
  const parser = STATEMENT_PARSERS[tagName];
  if (parser) {
    return parser(parserContext);
  }

  const ext = find(
    parserContext.extensions,
    (e) => (e.tags ?? []).includes(tagName) && Boolean(e.parse)
  );
  if (ext?.parse) {
    const parsedNode = ext.parse(parserContext, nodes, {
      TOKEN_SYMBOL,
      TOKEN_BLOCK_END,
      TOKEN_BLOCK_START,
      TOKEN_VARIABLE_END,
      TOKEN_VARIABLE_START,
      TOKEN_COMMENT,
      TOKEN_LEFT_PAREN,
      TOKEN_RIGHT_PAREN,
      TOKEN_LEFT_BRACKET,
      TOKEN_RIGHT_BRACKET,
      TOKEN_LEFT_CURLY,
      TOKEN_RIGHT_CURLY,
      TOKEN_OPERATOR,
      TOKEN_COMMA,
      TOKEN_COLON,
      TOKEN_TILDE,
      TOKEN_PIPEFORWARD,
      TOKEN_INT,
      TOKEN_FLOAT,
      TOKEN_BOOLEAN,
      TOKEN_NONE,
      TOKEN_STRING,
      TOKEN_DATA,
      TOKEN_WHITESPACE,
      TOKEN_REGEX,
    });
    if (parsedNode === null) {
      // WHY: a null return must not read as "stop parsing" — that silently truncates the
      // template. Extensions signal completion by returning a node.
      return fail(parserContext, {
        message: `extension tag '${String(tagName)}' parse returned no node`,
        lineno: tok.lineno,
        colno: tok.colno,
      });
    }
    return ok(parsedNode);
  }
  return fail(parserContext, {
    message: `unknown block tag: ${tok.value}`,
    lineno: tok.lineno,
    colno: tok.colno,
  });
};
