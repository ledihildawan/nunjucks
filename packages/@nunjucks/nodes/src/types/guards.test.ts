import { describe, test, expect } from 'bun:test';
import {
  literal, symbol, templateData, funCall, lookupVal, block,
  array, dict, pair, for_, if_,
} from '@nunjucks/nodes';
import {
  isNode, isLiteral, isSymbol,
  isFunCall, isLookupVal, isArray, isDict, isPair, isFor, isIf,
  isBlock, isSlice, isNodeList, isArrayPattern, isObjectPattern,
  isVariableDeclaration, isVariableAssignment,
} from './index.ts';

const isOutput = (n: unknown): n is { type: 'output'; lineno: number; colno: number; children: unknown[] } =>
  n !== null && typeof n === 'object' && (n as { type?: string }).type === 'output';

describe('nodes/types/guards', () => {
  describe('isNode', () => {
    test('returns true for a valid node', () => {
      expect(isNode(literal(0, 0, 'x'))).toBe(true);
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
      expect(isLiteral(literal(0, 0, 'hello'))).toBe(true);
    });

    test('returns false for symbol node', () => {
      expect(isLiteral(symbol(0, 0, 'x'))).toBe(false);
    });
  });

  describe('isSymbol', () => {
    test('returns true for symbol node', () => {
      expect(isSymbol(symbol(0, 0, 'x'))).toBe(true);
    });

    test('returns false for literal node', () => {
      expect(isSymbol(literal(0, 0, 'x'))).toBe(false);
    });
  });

  describe('isFunCall', () => {
    test('returns true for funCall node', () => {
      expect(isFunCall(funCall(0, 0, symbol(0, 0, 'fn'), []))).toBe(true);
    });

    test('returns false for lookupVal node', () => {
      expect(isFunCall(lookupVal(0, 0, symbol(0, 0, 'x'), literal(0, 0, 'y')))).toBe(false);
    });
  });

  describe('isLookupVal', () => {
    test('returns true for lookupVal node', () => {
      expect(isLookupVal(lookupVal(0, 0, symbol(0, 0, 'x'), literal(0, 0, 'y')))).toBe(true);
    });

    test('returns false for funCall node', () => {
      expect(isLookupVal(funCall(0, 0, symbol(0, 0, 'fn'), []))).toBe(false);
    });
  });

  describe('isArray', () => {
    test('returns true for array node', () => {
      expect(isArray(array(0, 0, [literal(0, 0, 1)]))).toBe(true);
    });

    test('returns false for dict node', () => {
      expect(isArray(dict(0, 0, []))).toBe(false);
    });
  });

  describe('isDict', () => {
    test('returns true for dict node', () => {
      expect(isDict(dict(0, 0, []))).toBe(true);
    });

    test('returns false for array node', () => {
      expect(isDict(array(0, 0, []))).toBe(false);
    });
  });

  describe('isPair', () => {
    test('returns true for pair node', () => {
      expect(isPair(pair(0, 0, literal(0, 0, 'key'), literal(0, 0, 'val')))).toBe(true);
    });

    test('returns false for literal node', () => {
      expect(isPair(literal(0, 0, 'x'))).toBe(false);
    });
  });

  describe('isFor', () => {
    test('returns true for for node', () => {
      expect(isFor(for_(0, 0, {
        name: symbol(0, 0, 'x'),
        arr: array(0, 0, []),
        body: templateData(0, 0, ''),
      }))).toBe(true);
    });

    test('returns false for if node', () => {
      expect(isFor(if_(0, 0, { cond: literal(0, 0, true), body: templateData(0, 0, '') }))).toBe(false);
    });
  });

  describe('isIf', () => {
    test('returns true for if node', () => {
      expect(isIf(if_(0, 0, {
        cond: literal(0, 0, true),
        body: templateData(0, 0, ''),
      }))).toBe(true);
    });

    test('returns false for for node', () => {
      expect(isIf(for_(0, 0, {
        name: symbol(0, 0, 'x'),
        arr: array(0, 0, []),
        body: templateData(0, 0, ''),
      }))).toBe(false);
    });
  });

  describe('isBlock', () => {
    test('returns true for block node', () => {
      expect(isBlock(block(0, 0, 'b', templateData(0, 0, '')))).toBe(true);
    });

    test('returns false for literal node', () => {
      expect(isBlock(literal(0, 0, 'x'))).toBe(false);
    });
  });

  describe('isOutput', () => {
    test('returns true for output node', () => {
      const n = { type: 'output', lineno: 0, colno: 0, children: [] };
      expect(isOutput(n)).toBe(true);
    });

    test('returns false for literal node', () => {
      expect(isOutput(literal(0, 0, 'x'))).toBe(false);
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
