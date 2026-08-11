import { describe, test, expect } from 'bun:test';
import { createState, advance } from '../state.ts';
import { createDelimiterTokenizer } from './delimiter.ts';
import {
  TOKEN_BLOCK_START,
  TOKEN_BLOCK_END,
  TOKEN_VARIABLE_START,
  TOKEN_VARIABLE_END,
} from '../token-types.ts';
import type { TokenType } from '../token-types.ts';
import {
  DEFAULT_BLOCK_START,
  DEFAULT_BLOCK_END,
  DEFAULT_VARIABLE_START,
  DEFAULT_VARIABLE_END,
  STRIP_BLOCK_START,
  STRIP_BLOCK_END,
  STRIP_VARIABLE_START,
  STRIP_VARIABLE_END,
} from '../delimiters.ts';
import type { Delimiters } from '../delimiters.ts';

const delimiterRoles: ReadonlyArray<{
  name: string;
  tokenType: TokenType;
  stripKey: keyof Delimiters;
  plainKey: keyof Delimiters;
  stripFlag: Record<string, boolean>;
  expectedFlag: 'stripLeft' | 'stripRight';
  stripLiteral: string;
  plainLiteral: string;
}> = [
  {
    name: 'block-start',
    tokenType: TOKEN_BLOCK_START,
    stripKey: 'stripBlockStart',
    plainKey: 'blockStart',
    stripFlag: { stripLeft: true },
    expectedFlag: 'stripLeft',
    stripLiteral: STRIP_BLOCK_START,
    plainLiteral: DEFAULT_BLOCK_START,
  },
  {
    name: 'block-end',
    tokenType: TOKEN_BLOCK_END,
    stripKey: 'stripBlockEnd',
    plainKey: 'blockEnd',
    stripFlag: { stripRight: true },
    expectedFlag: 'stripRight',
    stripLiteral: STRIP_BLOCK_END,
    plainLiteral: DEFAULT_BLOCK_END,
  },
  {
    name: 'variable-start',
    tokenType: TOKEN_VARIABLE_START,
    stripKey: 'stripVariableStart',
    plainKey: 'variableStart',
    stripFlag: { stripLeft: true },
    expectedFlag: 'stripLeft',
    stripLiteral: STRIP_VARIABLE_START,
    plainLiteral: DEFAULT_VARIABLE_START,
  },
  {
    name: 'variable-end',
    tokenType: TOKEN_VARIABLE_END,
    stripKey: 'stripVariableEnd',
    plainKey: 'variableEnd',
    stripFlag: { stripRight: true },
    expectedFlag: 'stripRight',
    stripLiteral: STRIP_VARIABLE_END,
    plainLiteral: DEFAULT_VARIABLE_END,
  },
];

describe('createDelimiterTokenizer', () => {
  describe('factory contract', () => {
    test('returns a tokenizer function', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      expect(typeof tokenize).toBe('function');
    });

    test('yields a { token, state } pair on a match', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      const result = tokenize(createState(DEFAULT_BLOCK_START));
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('state');
    });

    test('returns null for empty input', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      expect(tokenize(createState(''))).toBeNull();
    });

    test('is stateless across repeated invocations on equal input', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      const first = tokenize(createState(STRIP_BLOCK_START));
      const second = tokenize(createState(STRIP_BLOCK_START));
      expect(second?.token).toEqual(first?.token);
      expect(second?.state.index).toBe(first?.state.index);
    });
  });

  describe('delimiter role matrix', () => {
    test('detects the strip variant and sets only the matching strip flag', () => {
      delimiterRoles.forEach((role) => {
        const tokenize = createDelimiterTokenizer(
          role.tokenType, role.stripKey, role.plainKey, role.stripFlag,
        );
        const result = tokenize(createState(role.stripLiteral));
        expect({
          role: role.name,
          type: result?.token.type,
          value: result?.token.value,
          stripLeft: result?.token.stripLeft,
          stripRight: result?.token.stripRight,
        }).toEqual({
          role: role.name,
          type: role.tokenType,
          value: role.stripLiteral,
          stripLeft: role.expectedFlag === 'stripLeft' ? true : undefined,
          stripRight: role.expectedFlag === 'stripRight' ? true : undefined,
        });
      });
    });

    test('prefers the strip variant over a leading plain prefix match', () => {
      delimiterRoles.forEach((role) => {
        const tokenize = createDelimiterTokenizer(
          role.tokenType, role.stripKey, role.plainKey, role.stripFlag,
        );
        const result = tokenize(createState(role.stripLiteral));
        expect({
          role: role.name,
          matchedValue: result?.token.value,
          equalsPlainLiteral: result?.token.value === role.plainLiteral,
        }).toEqual({
          role: role.name,
          matchedValue: role.stripLiteral,
          equalsPlainLiteral: false,
        });
      });
    });

    test('tokenizes the plain variant without any strip metadata', () => {
      delimiterRoles.forEach((role) => {
        const tokenize = createDelimiterTokenizer(
          role.tokenType, role.stripKey, role.plainKey, role.stripFlag,
        );
        const result = tokenize(createState(role.plainLiteral));
        expect({
          role: role.name,
          type: result?.token.type,
          value: result?.token.value,
          stripLeft: result?.token.stripLeft,
          stripRight: result?.token.stripRight,
        }).toEqual({
          role: role.name,
          type: role.tokenType,
          value: role.plainLiteral,
          stripLeft: undefined,
          stripRight: undefined,
        });
      });
    });

    test('advances the state by the length of the matched delimiter', () => {
      delimiterRoles.forEach((role) => {
        const tokenize = createDelimiterTokenizer(
          role.tokenType, role.stripKey, role.plainKey, role.stripFlag,
        );
        const stripResult = tokenize(createState(role.stripLiteral));
        const plainResult = tokenize(createState(role.plainLiteral));
        expect({
          role: role.name,
          stripIndex: stripResult?.state.index,
          plainIndex: plainResult?.state.index,
        }).toEqual({
          role: role.name,
          stripIndex: role.stripLiteral.length,
          plainIndex: role.plainLiteral.length,
        });
      });
    });

    test('returns null when neither the strip nor plain variant matches', () => {
      delimiterRoles.forEach((role) => {
        const tokenize = createDelimiterTokenizer(
          role.tokenType, role.stripKey, role.plainKey, role.stripFlag,
        );
        expect({ role: role.name, result: tokenize(createState('abc')) }).toEqual({
          role: role.name,
          result: null,
        });
      });
    });
  });

  describe('strip flag semantics', () => {
    test('start delimiters flag stripLeft only', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_VARIABLE_START, 'stripVariableStart', 'variableStart', { stripLeft: true },
      );
      const result = tokenize(createState(STRIP_VARIABLE_START));
      expect(result?.token.stripLeft).toBe(true);
      expect(result?.token.stripRight).toBeUndefined();
    });

    test('end delimiters flag stripRight only', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_END, 'stripBlockEnd', 'blockEnd', { stripRight: true },
      );
      const result = tokenize(createState(STRIP_BLOCK_END));
      expect(result?.token.stripRight).toBe(true);
      expect(result?.token.stripLeft).toBeUndefined();
    });

    test('forwards a combined stripLeft and stripRight flag verbatim onto the strip token', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true, stripRight: true },
      );
      const result = tokenize(createState(STRIP_BLOCK_START));
      expect(result?.token.stripLeft).toBe(true);
      expect(result?.token.stripRight).toBe(true);
    });
  });

  describe('configured custom delimiters', () => {
    test('matches a custom-configured plain delimiter', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      const result = tokenize(createState('<<', { tags: { blockStart: '<<' } }));
      expect(result?.token.value).toBe('<<');
      expect(result?.token.stripLeft).toBeUndefined();
      expect(result?.state.index).toBe(2);
    });

    test('keeps the strip delimiter at the default constant regardless of custom plain tags', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      const result = tokenize(createState(STRIP_BLOCK_START, { tags: { blockStart: '<<' } }));
      expect(result?.token.value).toBe(STRIP_BLOCK_START);
      expect(result?.token.stripLeft).toBe(true);
    });

    test('returns null when input matches the default but not the custom plain delimiter', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      expect(tokenize(createState('{%', { tags: { blockStart: '<<' } }))).toBeNull();
    });
  });

  describe('position metadata and state threading', () => {
    test('token inherits lineno and colno from the inbound state', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      const positioned = advance(createState('  {%'), 2);
      const result = tokenize(positioned);
      expect(result?.token.lineno).toBe(0);
      expect(result?.token.colno).toBe(2);
    });

    test('resulting state threads forward from the inbound position', () => {
      const tokenize = createDelimiterTokenizer(
        TOKEN_BLOCK_START, 'stripBlockStart', 'blockStart', { stripLeft: true },
      );
      const positioned = advance(createState('  {%'), 2);
      const result = tokenize(positioned);
      expect(result?.state.index).toBe(4);
      expect(result?.state.colno).toBe(4);
    });
  });
});
