import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { ifNode } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';
import { parseUntilBlocks } from '../parse-root.ts';

interface IfBranch {
  tag: Token;
  cond: Node;
  body: Node;
}

const parseIfElseAlternate = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const elseEndR = advanceAfterBlockEnd(parserContext);
  if (isErr(elseEndR)) {
    return elseEndR;
  }
  const altBodyR = parseUntilBlocks(parserContext, 'endif');
  if (isErr(altBodyR)) {
    return altBodyR;
  }
  const endifEndR = advanceAfterBlockEnd(parserContext);
  if (isErr(endifEndR)) {
    return endifEndR;
  }
  return ok(altBodyR.value);
};

const parseIfBranch = (
  parserContext: ParserContext,
  first: boolean
): Result<IfBranch, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;

  const accepted = first
    ? skipSymbol(parserContext, 'if') ||
      skipSymbol(parserContext, 'elif') ||
      skipSymbol(parserContext, 'elseif')
    : skipSymbol(parserContext, 'elif') || skipSymbol(parserContext, 'elseif');
  if (!accepted) {
    return fail(parserContext, {
      message: 'parseIf: expected if, elif, or elseif',
      lineno: tag.lineno,
      colno: tag.colno,
    });
  }

  const condR = parseExpression(parserContext);
  if (isErr(condR)) {
    return condR;
  }
  const blockEndR = advanceAfterBlockEnd(parserContext, String(tag.value));
  if (isErr(blockEndR)) {
    return blockEndR;
  }

  const bodyR = parseUntilBlocks(parserContext, 'elif', 'elseif', 'else', 'endif');
  if (isErr(bodyR)) {
    return bodyR;
  }
  return ok({ tag, cond: condR.value, body: bodyR.value });
};

/**
 * Reads the token after a branch body: `elif`/`elseif` continues the loop
 * (`undefined`), `else` yields the final alternate body, and `endif` yields
 * `null`; anything else fails loudly.
 */
const parseIfTerminator = (
  parserContext: ParserContext
): Result<Node | null | undefined, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const terminator = tokR.value;
  switch (terminator.value) {
    case 'elseif':
    case 'elif':
      return ok(undefined);
    case 'else':
      return parseIfElseAlternate(parserContext);
    case 'endif': {
      const endifEndR = advanceAfterBlockEnd(parserContext);
      if (isErr(endifEndR)) {
        return endifEndR;
      }
      return ok(null);
    }
    default:
      return fail(parserContext, {
        message: 'parseIf: expected elif, else, or endif, got end of file',
      });
  }
};

const foldIfBranches = (branches: readonly IfBranch[], alternate: Node | null): Node => {
  let node: Node | null = alternate;
  for (let i = branches.length - 1; i >= 0; i--) {
    const branch = branches[i];
    if (branch) {
      node = ifNode(loc(branch.tag), { cond: branch.cond, body: branch.body, alternate: node });
    }
  }
  return node as Node;
};

/**
 * Parses `{% if %}`/`{% elif %}` branches, including `else` alternates, and
 * consumes the terminating `{% endif %}`.
 */
export const parseIf = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const branches: IfBranch[] = [];

  // WHY: iterative loop (parser loop exemption) — the recursive form recursed once per
  // `elif` branch (parseIf → parseIfAlternate → parseIf), so long elif chains
  // overflowed the stack. Branches are collected first, then folded right-to-left
  // into the exact nested ifNode shape the recursion produced.
  let first = true;
  while (true) {
    const branchR = parseIfBranch(parserContext, first);
    if (isErr(branchR)) {
      return branchR;
    }
    branches.push(branchR.value);
    first = false;

    const terminatorR = parseIfTerminator(parserContext);
    if (isErr(terminatorR)) {
      return terminatorR;
    }
    if (terminatorR.value !== undefined) {
      return ok(foldIfBranches(branches, terminatorR.value));
    }
  }
};
