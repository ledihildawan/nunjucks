import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { TOKEN_BLOCK_END, TOKEN_COMMA, TOKEN_OPERATOR, TOKEN_SYMBOL } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { pair, scopeNode } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, nextToken, peekToken, skip, skipSymbol } from '../cursor.ts';
import { parseExpression, parsePrimary } from '../expression-parser/index.ts';
import { parseUntilBlocks } from '../parse-root.ts';

const isBlockEnd = (tok: Token | null | undefined): boolean => tok?.type === TOKEN_BLOCK_END;

const parseScopeAssignment = (
  parserContext: ParserContext,
  tag: Token
): Result<Node, TemplateError> => {
  const nameSymbolR = parsePrimary(parserContext);
  if (isErr(nameSymbolR)) {
    return nameSymbolR;
  }
  const nameSymbol = nameSymbolR.value;
  const eqTokR = peekToken(parserContext);
  if (isErr(eqTokR)) {
    return eqTokR;
  }
  const eqTok = eqTokR.value;

  if (!eqTok || eqTok.type !== TOKEN_OPERATOR || eqTok.value !== '=') {
    return fail(parserContext, {
      message: 'parseScope: expected = after variable name',
      lineno: tag.lineno,
      colno: tag.colno,
    });
  }

  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
  const valueR = parseExpression(parserContext);
  if (isErr(valueR)) {
    return valueR;
  }

  return ok(pair(loc(nameSymbol), { key: String(nameSymbol.value), val: valueR.value }));
};

const parseScopeAssignments = (
  parserContext: ParserContext,
  tag: Token
): Result<Node[], TemplateError> => {
  const assignments: Node[] = [];
  const firstR = parseScopeAssignment(parserContext, tag);
  if (isErr(firstR)) {
    return firstR;
  }
  assignments.push(firstR.value);

  const collect = (): Result<Node[], TemplateError> => {
    if (!skip(parserContext, TOKEN_COMMA)) {
      return ok(assignments);
    }
    const nextNameTokR = peekToken(parserContext);
    if (isErr(nextNameTokR)) {
      return nextNameTokR;
    }
    if (nextNameTokR.value?.type !== TOKEN_SYMBOL) {
      return fail(parserContext, {
        message: 'parseScope: expected variable name after comma',
        lineno: tag.lineno,
        colno: tag.colno,
      });
    }

    const nextR = parseScopeAssignment(parserContext, tag);
    if (isErr(nextR)) {
      return nextR;
    }
    assignments.push(nextR.value);
    return collect();
  };

  return collect();
};

/**
 * Parses `{% scope a = 1, b = 2 %}...{% endscope %}`, scoping the listed
 * assignments to the block body; an empty header is allowed.
 */
export const parseScope = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'scope')) {
    return fail(parserContext, {
      message: 'parseScope: expected scope',
      lineno: tag.lineno,
      colno: tag.colno,
    });
  }

  const firstTokR = peekToken(parserContext);
  if (isErr(firstTokR)) {
    return firstTokR;
  }
  const firstTok = firstTokR.value;

  let assignments: Node[] = [];
  if (isBlockEnd(firstTok)) {
    const advanceResult = advanceAfterBlockEnd(parserContext, 'scope');
    if (isErr(advanceResult)) {
      return advanceResult;
    }
  } else if (firstTok?.type === TOKEN_SYMBOL) {
    const assignmentsR = parseScopeAssignments(parserContext, tag);
    if (isErr(assignmentsR)) {
      return assignmentsR;
    }
    assignments = assignmentsR.value;
    const advanceResult = advanceAfterBlockEnd(parserContext, 'scope');
    if (isErr(advanceResult)) {
      return advanceResult;
    }
  } else {
    return fail(parserContext, {
      message: 'parseScope: expected variable name or block end',
      lineno: tag.lineno,
      colno: tag.colno,
    });
  }

  const bodyR = parseUntilBlocks(parserContext, 'endscope');
  if (isErr(bodyR)) {
    return bodyR;
  }

  if (!skipSymbol(parserContext, 'endscope')) {
    return fail(parserContext, {
      message: 'parseScope: expected endscope',
      lineno: tag.lineno,
      colno: tag.colno,
    });
  }

  const finalR = advanceAfterBlockEnd(parserContext, 'endscope');
  if (isErr(finalR)) {
    return finalR;
  }

  return ok(scopeNode(loc(tag), { assignments, body: bodyR.value }));
};
