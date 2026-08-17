import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { TOKEN_BLOCK_END, TOKEN_COMMA } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { appendChild, fromImportNode, nodeList, pair } from '@nunjucks/nodes';
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
  names: ChildrenNode
): Result<{ names: ChildrenNode; withContext: boolean | null | undefined }, TemplateError> => {
  const nameR = parsePrimary(parserContext);
  if (isErr(nameR)) {
    return nameR;
  }
  const name = nameR.value;
  if (isUnderscore(name)) {
    return fail(parserContext, { message: 'parseFrom: names starting with an underscore cannot be imported', lineno: name.lineno,
      colno: name.colno, });
  }

  const hasAlias = skipSymbol(parserContext, 'as');
  let newNames: ChildrenNode;
  if (hasAlias) {
    const aliasR = parsePrimary(parserContext);
    if (isErr(aliasR)) {
      return aliasR;
    }
    newNames = appendChild(names, pair(loc(name), { key: name, val: aliasR.value }));
  } else {
    newNames = appendChild(names, name);
  }

  const withContextR = parseWithContext(parserContext);
  if (isErr(withContextR)) {
    return withContextR;
  }
  return ok({ names: newNames, withContext: withContextR.value });
};

const handleBlockEnd = (
  parserContext: ParserContext,
  names: ChildrenNode,
  fromTok: Token
): Result<void, TemplateError> => {
  if (names.children.length === 0) {
    return fail(parserContext, { message: 'parseFrom: Expected at least one import name', lineno: fromTok.lineno,
      colno: fromTok.colno, });
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
  names: ChildrenNode,
  fromTok: Token
): Result<
  { names: ChildrenNode; withContext: boolean | null | undefined; done: boolean },
  TemplateError
> => {
  const nextTokR = peekToken(parserContext);
  if (isErr(nextTokR)) {
    return nextTokR;
  }
  if (nextTokR.value.type === TOKEN_BLOCK_END) {
    const endR = handleBlockEnd(parserContext, names, fromTok);
    if (isErr(endR)) {
      return endR;
    }
    return ok({ names, withContext: undefined, done: true });
  }

  if (names.children.length > 0 && !skip(parserContext, TOKEN_COMMA)) {
    return fail(parserContext, { message: 'parseFrom: expected comma', lineno: fromTok.lineno,
      colno: fromTok.colno, });
  }

  const result = parseImportName(parserContext, names);
  if (isErr(result)) {
    return result;
  }
  return ok({ names: result.value.names, withContext: result.value.withContext, done: false });
};

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
    return fail(parserContext, { message: 'parseFrom: expected import', lineno: fromTok.lineno,
      colno: fromTok.colno, });
  }

  const importLoop = (
    accNames: ChildrenNode,
    accWithContext: boolean | null | undefined
  ): Result<{ names: ChildrenNode; withContext: boolean | null | undefined }, TemplateError> => {
    const iterR = parseFromImportIteration(parserContext, accNames, fromTok);
    if (isErr(iterR)) {
      return iterR;
    }
    if (iterR.value.done) {
      return ok({ names: accNames, withContext: accWithContext });
    }
    // WHY: OR-accumulate — a mid-list `with context` marker must survive later
    // iterations; plain overwrite silently dropped it for every following name.
    return importLoop(iterR.value.names, iterR.value.withContext ?? accWithContext);
  };

  const loopR = importLoop(nodeList(loc(fromTok)), undefined);
  if (isErr(loopR)) {
    return loopR;
  }

  return ok(
    fromImportNode(loc(fromTok), {
      template: templateR.value,
      names: loopR.value.names,
      withContext: loopR.value.withContext ?? false,
    })
  );
};
