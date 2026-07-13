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
    const body = { lineno: 1, colno: 13 };

    const ctx = Object.assign(createCursor(tokens), {
      parseSignature: () => nodes.nodeList(),
      parsePrimary: () => macroCall,
      parseUntilBlocks: () => body,
    });

    const result = parseCall(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('output');
  });

  test('parses call with args and adds caller to kwargs', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'call', lineno: 1, colno: 1 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'endcall', lineno: 1, colno: 15 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 23 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const sigArgs = nodes.nodeList();
    const kwargs = nodes.keywordArgs();
    sigArgs.addChild(kwargs);
    const name = nodes.symbol(1, 6, 'myMacro');
    const macroCall = nodes.funCall(1, 1, name, sigArgs);
    const body = { lineno: 1, colno: 13 };

    const ctx = Object.assign(createCursor(tokens), {
      parseSignature: () => sigArgs,
      parsePrimary: () => macroCall,
      parseUntilBlocks: () => body,
    });

    const result = parseCall(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('output');
    const funCall = result.children[0];
    const callKwargs = funCall.args.children.at(-1);
    expect(nodes.isKeywordArgs(callKwargs)).toBe(true);
    expect(nodes.isPair(callKwargs.children[0])).toBe(true);
    expect(callKwargs.children[0].key.value).toBe('caller');
  });

  test('fails if not call keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseCall(ctx)).toThrow('expected call');
  });
});
