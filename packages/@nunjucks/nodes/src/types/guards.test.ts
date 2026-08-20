import { describe, expect, test } from 'bun:test';
import { ZERO_LOC } from '@nunjucks/shared';
import {
  array,
  block,
  dict,
  forNode,
  funCall,
  ifNode,
  literal,
  lookupVal,
  pair,
  symbol,
  templateData,
} from '../index.ts';
import {
  isArray,
  isArrayPattern,
  isBlock,
  isDict,
  isFunCall,
  isIf,
  isLiteral,
  isLookupVal,
  isNode,
  isNodeList,
  isObjectPattern,
  isPair,
  isSlice,
  isSymbol,
  isVariableAssignment,
  isVariableDeclaration,
} from './index.ts';

describe('nodes/types/guards', () => {
  describe('isNode', () => {
    test('returns true for a valid node', () => {
      expect(isNode(literal(ZERO_LOC, 'x'))).toBe(true);
    });

    test('returns false for null', () => {
      expect(isNode(null)).toBe(false);
    });

    test('returns false for plain object missing type', () => {
      expect(isNode({ lineno: 0, colno: 0 })).toBe(false);
    });

    test('returns false for object with unknown type', () => {
      expect(isNode({ type: 'unknownType', lineno: 0, colno: 0 })).toBe(false);
    });

    test('returns false for object missing lineno/colno', () => {
      expect(isNode({ type: 'literal' })).toBe(false);
    });
  });

  describe('isLiteral', () => {
    test('returns true for literal node', () => {
      expect(isLiteral(literal(ZERO_LOC, 'hello'))).toBe(true);
    });

    test('returns false for symbol node', () => {
      expect(isLiteral(symbol(ZERO_LOC, 'x'))).toBe(false);
    });
  });

  describe('isSymbol', () => {
    test('returns true for symbol node', () => {
      expect(isSymbol(symbol(ZERO_LOC, 'x'))).toBe(true);
    });

    test('returns false for literal node', () => {
      expect(isSymbol(literal(ZERO_LOC, 'x'))).toBe(false);
    });
  });

  describe('isFunCall', () => {
    test('returns true for funCall node', () => {
      expect(isFunCall(funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'fn'), args: [] }))).toBe(true);
    });

    test('returns false for lookupVal node', () => {
      expect(
        isFunCall(
          lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'x'), val: literal(ZERO_LOC, 'y') })
        )
      ).toBe(false);
    });
  });

  describe('isLookupVal', () => {
    test('returns true for lookupVal node', () => {
      expect(
        isLookupVal(
          lookupVal(ZERO_LOC, { target: symbol(ZERO_LOC, 'x'), val: literal(ZERO_LOC, 'y') })
        )
      ).toBe(true);
    });

    test('returns false for funCall node', () => {
      expect(isLookupVal(funCall(ZERO_LOC, { name: symbol(ZERO_LOC, 'fn'), args: [] }))).toBe(
        false
      );
    });
  });

  describe('isArray', () => {
    test('returns true for array node', () => {
      expect(isArray(array(ZERO_LOC, [literal(ZERO_LOC, 1)]))).toBe(true);
    });

    test('returns false for dict node', () => {
      expect(isArray(dict(ZERO_LOC, []))).toBe(false);
    });
  });

  describe('isDict', () => {
    test('returns true for dict node', () => {
      expect(isDict(dict(ZERO_LOC, []))).toBe(true);
    });

    test('returns false for array node', () => {
      expect(isDict(array(ZERO_LOC, []))).toBe(false);
    });
  });

  describe('isPair', () => {
    test('returns true for pair node', () => {
      expect(
        isPair(pair(ZERO_LOC, { key: literal(ZERO_LOC, 'key'), val: literal(ZERO_LOC, 'val') }))
      ).toBe(true);
    });

    test('returns false for literal node', () => {
      expect(isPair(literal(ZERO_LOC, 'x'))).toBe(false);
    });
  });

  describe('isIf', () => {
    test('returns true for if node', () => {
      expect(
        isIf(
          ifNode(ZERO_LOC, {
            cond: literal(ZERO_LOC, true),
            body: templateData(ZERO_LOC, ''),
          })
        )
      ).toBe(true);
    });

    test('returns false for for node', () => {
      expect(
        isIf(
          forNode(ZERO_LOC, {
            name: symbol(ZERO_LOC, 'x'),
            arr: array(ZERO_LOC, []),
            body: templateData(ZERO_LOC, ''),
          })
        )
      ).toBe(false);
    });
  });

  describe('isBlock', () => {
    test('returns true for block node', () => {
      expect(isBlock(block(ZERO_LOC, { name: 'b', body: templateData(ZERO_LOC, '') }))).toBe(true);
    });

    test('returns false for literal node', () => {
      expect(isBlock(literal(ZERO_LOC, 'x'))).toBe(false);
    });
  });

  describe('isSlice', () => {
    test('returns true for slice node', () => {
      const n = { type: 'slice', lineno: 0, colno: 0 };
      expect(isSlice(n)).toBe(true);
    });
  });

  describe('isNodeList', () => {
    test('returns true for nodeList node', () => {
      const n = { type: 'nodeList', lineno: 0, colno: 0, children: [] };
      expect(isNodeList(n)).toBe(true);
    });
  });

  describe('isArrayPattern', () => {
    test('returns true for arrayPattern node', () => {
      const n = { type: 'arrayPattern', lineno: 0, colno: 0, children: [] };
      expect(isArrayPattern(n)).toBe(true);
    });
  });

  describe('isObjectPattern', () => {
    test('returns true for objectPattern node', () => {
      const n = { type: 'objectPattern', lineno: 0, colno: 0, children: [] };
      expect(isObjectPattern(n)).toBe(true);
    });
  });

  describe('type guard predicates', () => {
    test('isVariableDeclaration narrows correctly', () => {
      const decl = { type: 'variableDeclaration', lineno: 0, colno: 0 };
      expect(isVariableDeclaration(decl)).toBe(true);
    });

    test('isVariableAssignment narrows correctly', () => {
      const assign = { type: 'variableAssignment', lineno: 0, colno: 0 };
      expect(isVariableAssignment(assign)).toBe(true);
    });
  });
});
