import { describe, test, expect } from 'bun:test';
import { parseRaw } from './raw.js';
import { nodes } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseRaw', () => {
  test('parses raw block content', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'raw', lineno: 1, colno: 7 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 11 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const extractCalls = [];
    const backNCalls = [];
    const _extractRegex = () => {
      if (extractCalls.length === 0) {
        extractCalls.push(1);
        return ['{% endraw %}', 'some content here', 'endraw'];
      }
      return null;
    };
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(createCursor(tokens).tokens, {
        _extractRegex,
        backN: (len) => { backNCalls.push(len); },
      }),
    });

    const result = parseRaw(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('output');
    expect(nodes.getNodeTypeName(result.children[0])).toBe('templateData');
    expect(result.children[0].value).toBe('some content here');
  });

  test('handles nested raw blocks', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'raw', lineno: 1, colno: 1 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 5 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const extractCalls = [];
    const _extractRegex = () => {
      if (extractCalls.length === 0) {
        extractCalls.push(1);
        return ['outer {% raw %}', 'outer ', 'raw'];
      }
      if (extractCalls.length === 1) {
        extractCalls.push(2);
        return ['inner{% endraw %}', 'inner', 'endraw'];
      }
      if (extractCalls.length === 2) {
        extractCalls.push(3);
        return [' middle {% endraw %}', ' middle ', 'endraw'];
      }
      return null;
    };
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(createCursor(tokens).tokens, {
        _extractRegex,
        backN: () => {},
      }),
    });

    const result = parseRaw(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('output');
    expect(result.children[0].value).toBe('outer {% raw %}inner{% endraw %} middle ');
  });

  test('handles raw block with surrounding content', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'raw', lineno: 2, colno: 1 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 2, colno: 5 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const _extractRegex = () => {
      return ['prefix content{% endraw %}', 'prefix content', 'endraw'];
    };
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(createCursor(tokens).tokens, {
        _extractRegex,
        backN: () => {},
      }),
    });

    const result = parseRaw(ctx);

    expect(result.children[0].value).toBe('prefix content');
  });

  test('sets correct line/col from begun token', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'raw', lineno: 5, colno: 10 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 5, colno: 14 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const _extractRegex = () => ['{% endraw %}', 'content', 'endraw'];
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(createCursor(tokens).tokens, {
        _extractRegex,
        backN: () => {},
      }),
    });

    const result = parseRaw(ctx);

    expect(result.lineno).toBe(5);
    expect(result.colno).toBe(14);
  });

  test('uses custom tag name', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'myraw', lineno: 1, colno: 1 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const _extractRegex = () => ['{% endmyraw %}', 'custom content', 'endmyraw'];
    const ctx = Object.assign(createCursor(tokens), {
      tokens: Object.assign(createCursor(tokens).tokens, {
        _extractRegex,
        backN: () => {},
      }),
    });

    const result = parseRaw(ctx, 'myraw');

    expect(result.children[0].value).toBe('custom content');
  });
});
