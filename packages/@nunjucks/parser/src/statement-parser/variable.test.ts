import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { parseVariableDeclaration, parseVariableAssignment } from './variable.ts';
import { getNodeTypeName } from '@nunjucks/nodes';
import type { ParserContext } from '../cursor.ts';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream } from '../test-helpers.ts';

const parseStatement = (
  src: string,
  parser: (ctx: ParserContext) => Node
): Node => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  nextTokenOrNull(ctx);
  return parser(ctx as never);
};

describe('parseVariableDeclaration (:=)', () => {
  test('parses a variable declaration', () => {
    const node = parseStatement('{% x := 5 %}', parseVariableDeclaration);
    expect(getNodeTypeName(node)).toBe('variableDeclaration');
    const targets = (node as { targets: readonly Node[] }).targets;
    expect(targets).toHaveLength(1);
    expect((targets[0] as Node).value).toBe('x');
  });

  test('parses a declaration with an expression value', () => {
    const node = parseStatement('{% x := a + b %}', parseVariableDeclaration);
    expect(getNodeTypeName((node as { value: Node }).value)).toBe('add');
  });
});

describe('parseVariableAssignment (=)', () => {
  test('parses a plain assignment', () => {
    const node = parseStatement('{% x = 5 %}', parseVariableAssignment);
    expect(getNodeTypeName(node)).toBe('variableAssignment');
    const targets = (node as { targets: readonly Node[] }).targets;
    expect(targets).toHaveLength(1);
  });

  test('parses a compound assignment', () => {
    const node = parseStatement('{% x += 1 %}', parseVariableAssignment);
    expect(getNodeTypeName(node)).toBe('compoundAssignment');
  });

  test('records the compound operator', () => {
    const node = parseStatement('{% x += 1 %}', parseVariableAssignment);
    expect((node as { operator: string }).operator).toBe('+=');
  });
});