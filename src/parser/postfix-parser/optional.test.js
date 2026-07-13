import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { parseOptionalChain } from './optional.js';
import { nodes } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseOptionalChain', () => {
  test('parses optional chain with symbol', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'bar', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'bar', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);
    const tok = { lineno: 1, colno: 2, type: 'operator', value: '?.' };
    const target = { lineno: 1, colno: 1, typename: 'symbol', value: 'foo' };

    const result = parseOptionalChain(ctx, tok, target);

    expect(nodes.isOptionalChain(result)).toBe(true);
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(2);
    expect(result.target).toBe(target);
    expect(nodes.isLiteral(result.val)).toBe(true);
    expect(result.val.value).toBe('bar');
  });

  test('fails on non-symbol token', () => {
    const seq = [
      { type: 'int', value: '42', lineno: 1, colno: 3 },
      { type: 'int', value: '42', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);
    const tok = { lineno: 1, colno: 2, type: 'operator', value: '?.' };
    const target = { lineno: 1, colno: 1, typename: 'symbol', value: 'foo' };

    expect(() => parseOptionalChain(ctx, tok, target)).toThrow('expected name');
  });
});

describe('optional call parsing (integration)', () => {
  test('parses optional call with no args', () => {
    const ast = parse('{{ foo?.() }}');
    const output = ast.children[0].children[0];
    expect(nodes.getNodeTypeName(output)).toBe('optionalCall');
    expect(output.name.value).toBe('foo');
    expect(output.args.children).toHaveLength(0);
  });

  test('parses optional call with args', () => {
    const ast = parse('{{ foo?.(x) }}');
    const output = ast.children[0].children[0];
    expect(nodes.getNodeTypeName(output)).toBe('optionalCall');
    expect(output.name.value).toBe('foo');
    expect(output.args.children).toHaveLength(1);
  });

  test('parses optional call with multiple args', () => {
    const ast = parse('{{ foo?.(x, y) }}');
    const output = ast.children[0].children[0];
    expect(nodes.getNodeTypeName(output)).toBe('optionalCall');
    expect(output.args.children).toHaveLength(2);
  });

  test('parses method optional call', () => {
    const ast = parse('{{ obj.method?.() }}');
    const output = ast.children[0].children[0];
    expect(nodes.getNodeTypeName(output)).toBe('optionalCall');
    expect(nodes.getNodeTypeName(output.name)).toBe('lookupVal');
  });
});
