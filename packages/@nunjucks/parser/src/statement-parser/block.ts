import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { block, isSymbol } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parsePrimary } from '../expression-parser/index.ts';

/** Parses `{% block name %}...{% endblock %}`, tolerating a repeated name after `endblock`. */
export const parseBlock = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'block')) {
    return fail(parserContext, {
      message: 'parseBlock: expected block',
      lineno: tag.lineno,
      colno: tag.colno,
    });
  }

  const nameR = parsePrimary(parserContext);
  if (isErr(nameR)) {
    return nameR;
  }
  const name = nameR.value;
  if (!isSymbol(name)) {
    return fail(parserContext, {
      message: 'parseBlock: variable name expected',
      lineno: tag.lineno,
      colno: tag.colno,
    });
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, 'block');
  if (isErr(blockEndR)) {
    return blockEndR;
  }

  const bodyR = parserContext.parseUntilBlocks('endblock');
  if (isErr(bodyR)) {
    return bodyR;
  }
  skipSymbol(parserContext, 'endblock');
  skipSymbol(parserContext, String(name.value));

  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;

  const finalR = advanceAfterBlockEnd(parserContext, String(tok.value));
  if (isErr(finalR)) {
    return finalR;
  }

  return ok(block(loc(tag), { name: String(name.value), body: bodyR.value }));
};
