import { describe, test, expect } from 'bun:test';
import { parseCall } from './call.js';
import {
  NodeList, Output, Caller, AstSymbol, KeywordArgs, Pair, FunCall,
} from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
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
    const macroCall = new FunCall(1, 1, new AstSymbol(1, 6, 'myMacro'), new NodeList());
    const body = { lineno: 1, colno: 13 };

    const ctx = Object.assign(createCursor(tokens), {
      parseSignature: () => new NodeList(),
      parsePrimary: () => macroCall,
      parseUntilBlocks: () => body,
    });

    const result = parseCall(ctx);

    expect(result).toBeInstanceOf(Output);
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
    const sigArgs = new NodeList();
    const kwargs = new KeywordArgs();
    sigArgs.addChild(kwargs);
    const name = new AstSymbol(1, 6, 'myMacro');
    const macroCall = new FunCall(1, 1, name, sigArgs);
    const body = { lineno: 1, colno: 13 };

    const ctx = Object.assign(createCursor(tokens), {
      parseSignature: () => sigArgs,
      parsePrimary: () => macroCall,
      parseUntilBlocks: () => body,
    });

    const result = parseCall(ctx);

    expect(result).toBeInstanceOf(Output);
    const funCall = result.children[0];
    const callKwargs = funCall.args.children[funCall.args.children.length - 1];
    expect(callKwargs).toBeInstanceOf(KeywordArgs);
    expect(callKwargs.children[0]).toBeInstanceOf(Pair);
    expect(callKwargs.children[0].key.value).toBe('caller');
  });

  test('fails if not call keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseCall(ctx)).toThrow('expected call');
  });
});
