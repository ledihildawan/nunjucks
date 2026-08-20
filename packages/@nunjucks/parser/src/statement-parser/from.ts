import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { TOKEN_BLOCK_END, TOKEN_COMMA } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { fromImportNode, nodeList, pair } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skip, skipSymbol } from '../cursor.ts';
import { parseExpression, parsePrimary } from '../expression-parser/index.ts';
import { parseWithContext } from './import-context.ts';

const isUnderscore = (name: Node): boolean => {
  if (typeof name.value === 'string' && name.value[0] === '_') {
    return true;
  }
  return false;
};

const parseImportName = (
  parserContext: ParserContext,
  names: Node[]
): Result<boolean | null | undefined, TemplateError> => {
  const nameR = parsePrimary(parserContext);
  if (isErr(nameR)) {
    return nameR;
  }
  const name = nameR.value;
  if (isUnderscore(name)) {
    return fail(parserContext, {
      message: 'parseFrom: names starting with an underscore cannot be imported',
      lineno: name.lineno,
      colno: name.colno,
    });
  }

  const hasAlias = skipSymbol(parserContext, 'as');
  if (hasAlias) {
    const aliasR = parsePrimary(parserContext);
    if (isErr(aliasR)) {
      return aliasR;
    }
    names.push(pair(loc(name), { key: name, val: aliasR.value }));
  } else {
    names.push(name);
  }

  const withContextR = parseWithContext(parserContext);
  if (isErr(withContextR)) {
    return withContextR;
  }
  return ok(withContextR.value);
};

const handleBlockEnd = (
  parserContext: ParserContext,
  names: Node[],
  fromTok: Token
): Result<void, TemplateError> => {
  if (names.length === 0) {
    return fail(parserContext, {
      message: 'parseFrom: Expected at least one import name',
      lineno: fromTok.lineno,
      colno: fromTok.colno,
    });
  }

  // WHY: advanceAfterBlockEnd validates the block-end shape and honors `-%}`
  // whitespace control — the previous hand-rolled nextToken did neither (the dead
  // symbol-sniffing branch could never fire for a peeked block-end token).
  const blockEndR = advanceAfterBlockEnd(parserContext, 'from');
  if (isErr(blockEndR)) {
    return blockEndR;
  }
  return ok(undefined);
};

const parseFromImportIteration = (
  parserContext: ParserContext,
  names: Node[],
  fromTok: Token
): Result<{ withContext: boolean | null | undefined; done: boolean }, TemplateError> => {
  const nextTokR = peekToken(parserContext);
  if (isErr(nextTokR)) {
    return nextTokR;
  }
  if (nextTokR.value.type === TOKEN_BLOCK_END) {
    const endR = handleBlockEnd(parserContext, names, fromTok);
    if (isErr(endR)) {
      return endR;
    }
    return ok({ withContext: undefined, done: true });
  }

  if (names.length > 0 && !skip(parserContext, TOKEN_COMMA)) {
    return fail(parserContext, {
      message: 'parseFrom: expected comma',
      lineno: fromTok.lineno,
      colno: fromTok.colno,
    });
  }

  const result = parseImportName(parserContext, names);
  if (isErr(result)) {
    return result;
  }
  return ok({ withContext: result.value, done: false });
};

/**
 * Parses `{% from template import a as b, c with context %}`: a
 * comma-separated name/alias list where underscore-prefixed names are
 * rejected and a mid-list `with context` marker applies to every name.
 */
export const parseFrom = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const fromTokR = peekToken(parserContext);
  if (isErr(fromTokR)) {
    return fromTokR;
  }
  const fromTok = fromTokR.value;
  if (!skipSymbol(parserContext, 'from')) {
    return fail(parserContext, { message: 'parseFrom: expected from' });
  }

  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) {
    return templateR;
  }

  if (!skipSymbol(parserContext, 'import')) {
    return fail(parserContext, {
      message: 'parseFrom: expected import',
      lineno: fromTok.lineno,
      colno: fromTok.colno,
    });
  }

  // WHY: iterative loop with a local accumulator (parser loop exemption) — the
  // recursive importLoop recursed once per imported name and threaded each one
  // through the copying appendChild (O(n²)), so `{% from x import a,b,c,... %}`
  // overflowed the stack and crawled on long lists.
  const names: Node[] = [];
  let withContext: boolean | null | undefined;
  while (true) {
    const iterR = parseFromImportIteration(parserContext, names, fromTok);
    if (isErr(iterR)) {
      return iterR;
    }
    if (iterR.value.done) {
      break;
    }
    // WHY: OR-accumulate — a mid-list `with context` marker must survive later
    // iterations; plain overwrite silently dropped it for every following name.
    withContext = iterR.value.withContext ?? withContext;
  }

  return ok(
    fromImportNode(loc(fromTok), {
      template: templateR.value,
      names: nodeList(loc(fromTok), names),
      withContext: withContext ?? false,
    })
  );
};
