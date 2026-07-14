import { describe, test, expect } from 'bun:test';
import { parseCall } from './call.js';
import { nodes } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseCall', () => {
  test('parses call statement', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'call', lineno: 1, colno: 1 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'endcall', lineno: 1, colno: 15 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 23 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const macroCall = nodes.funCall(1, 1, nodes.symbol(1, 6, 'myMacro'), nodes.nodeList());
    const body = [nodes.literal(1, 13, 'content')];

    const ctx = Object.assign(createCursor(tokens), {
      parseSignature: () => nodes.nodeList(),
      parsePrimary: () => macroCall,
      parseUntilBlocks: () => body,
    });

    const result = parseCall(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('call');
    expect(nodes.isCall(result)).toBe(true);
    expect(result.name).toBe(macroCall);
    expect(result.body).toBe(body);
  });

  test('parses call with caller args', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'call', lineno: 1, colno: 1 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'endcall', lineno: 1, colno: 15 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 23 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const callerArgs = nodes.nodeList();
    const macroCall = nodes.funCall(1, 1, nodes.symbol(1, 6, 'myMacro'), nodes.nodeList());
    const body = [nodes.literal(1, 13, 'content')];

    const ctx = Object.assign(createCursor(tokens), {
      parseSignature: () => callerArgs,
      parsePrimary: () => macroCall,
      parseUntilBlocks: () => body,
    });

    const result = parseCall(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('call');
    expect(nodes.isCall(result)).toBe(true);
    expect(result.name).toBe(macroCall);
    expect(result.args).toBe(callerArgs);
    expect(result.body).toBe(body);
  });

  test('fails if not call keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseCall(ctx)).toThrow('expected call');
  });
});
