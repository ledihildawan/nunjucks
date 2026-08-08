import { describe, test, expect } from 'bun:test';
import { nodes } from '@nunjucks/nodes';
import { validateExpression, ExpressionSecurityError } from './expression';
import { loc, ZERO_LOC } from '@nunjucks/shared';

const ExprErr = ExpressionSecurityError;

describe('validateExpression', () => {
  describe('safe expressions', () => {
    test('simple symbol passes', () => {
      const ast = nodes.symbol(ZERO_LOC, 'name');
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });

    test('literal value passes', () => {
      const ast = nodes.literal(ZERO_LOC, 'hello');
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });

    test('safe property lookup passes', () => {
      const ast = nodes.lookupVal(ZERO_LOC, { target: nodes.symbol(ZERO_LOC, 'obj'), val: nodes.literal(ZERO_LOC, 'safeProp') });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });

    test('safe function call passes', () => {
      const ast = nodes.funCall(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'greet'), args: [
        nodes.literal(ZERO_LOC, 'world'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });

    test('safe pipe expression passes', () => {
      const ast = nodes.pipe(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'upper'), args: [
        nodes.symbol(ZERO_LOC, 'name'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });
  });

  describe('UNSAFE_PROPERTY - dangerous symbol access', () => {
    test('__proto__ symbol triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.symbol(ZERO_LOC, '__proto__');
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('__proto__');
    });

    test('constructor symbol triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.symbol(ZERO_LOC, 'constructor');
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('constructor');
    });

    test('prototype symbol triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.symbol(ZERO_LOC, 'prototype');
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('prototype');
    });

    test('hasOwnProperty symbol triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.symbol(ZERO_LOC, 'hasOwnProperty');
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
    });

    test('toString symbol triggers UNSAFE_PROPERTY (in OBJECT_INTRINSICS)', () => {
      const ast = nodes.symbol(ZERO_LOC, 'toString');
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
    });
  });

  describe('UNSAFE_PROPERTY - blocked pattern matching on lookupVal', () => {
    test('lookupVal with __secret__ triggers UNSAFE_PROPERTY via blocked pattern', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.literal(ZERO_LOC, '__secret__'),
      });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('matches blocked pattern');
    });

    test('lookupVal with property ending in constructor triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.literal(ZERO_LOC, 'some_constructor'),
      });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('matches blocked pattern');
    });

    test('lookupVal with property ending in prototype triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.literal(ZERO_LOC, 'my_prototype'),
      });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('matches blocked pattern');
    });

    test('custom blocked pattern configuration works on lookupVal', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.literal(ZERO_LOC, 'secretKey'),
      });
      const { errors } = validateExpression(ast, { blockedPropertyPatterns: [/^secret/] });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
    });

    test('blocked patterns can be cleared to allow blocked properties', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.literal(ZERO_LOC, '__secret__'),
      });
      const { errors } = validateExpression(ast, { blockedPropertyPatterns: [] });
      expect(errors).toHaveLength(0);
    });
  });

  describe('UNSAFE_PROPERTY - dangerous function calls', () => {
    test('eval() triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.funCall(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'eval'), args: [
        nodes.literal(ZERO_LOC, 'x'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('eval');
    });

    test('Function() triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.funCall(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'Function'), args: [
        nodes.literal(ZERO_LOC, 'x'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('Function');
    });

    test('setTimeout() triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.funCall(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'setTimeout'), args: [
        nodes.symbol(ZERO_LOC, 'callback'),
        nodes.literal(ZERO_LOC, 100),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('setTimeout');
    });

    test('AsyncFunction() triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.funCall(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'AsyncFunction'), args: [
        nodes.literal(ZERO_LOC, 'x'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
    });

    test('GeneratorFunction() triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.funCall(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'GeneratorFunction'), args: [
        nodes.literal(ZERO_LOC, 'x'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
    });
  });

  describe('dynamic property access', () => {
    test('lookupVal with non-literal property does not produce errors by default', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.symbol(ZERO_LOC, 'dynamicProp'),
      });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });

    test('allowDynamicPropertyAccess: true allows dynamic property access', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.symbol(ZERO_LOC, 'dynamicProp'),
      });
      const { errors } = validateExpression(ast, { allowDynamicPropertyAccess: true });
      expect(errors).toHaveLength(0);
    });

    test('lookupVal with literal string property does not trigger errors', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.literal(ZERO_LOC, 'safeProp'),
      });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });

    test('lookupVal with literal numeric property does not trigger errors', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'arr'),
        val: nodes.literal(ZERO_LOC, 42),
      });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });
  });

  describe('nested dangerous access', () => {
    test('obj.__proto__ walks both target and val, producing multiple errors', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.symbol(ZERO_LOC, '__proto__'),
      });
      const { errors } = validateExpression(ast);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.code === ExprErr.UNSAFE_PROPERTY)).toBe(true);
    });

    test('obj.constructor triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.symbol(ZERO_LOC, 'constructor'),
      });
      const { errors } = validateExpression(ast);
      expect(errors.some((e) => e.code === ExprErr.UNSAFE_PROPERTY)).toBe(true);
    });

    test('deeply nested dangerous access', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.lookupVal(ZERO_LOC, { target: nodes.symbol(ZERO_LOC, 'a'), val: nodes.symbol(ZERO_LOC, 'b') }),
        val: nodes.symbol(ZERO_LOC, '__proto__'),
      });
      const { errors } = validateExpression(ast);
      expect(errors.some((e) => e.code === ExprErr.UNSAFE_PROPERTY)).toBe(true);
    });

    test('dangerous property access in lookupVal target continues walking', () => {
      const innerLookup = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, '__proto__'),
        val: nodes.symbol(ZERO_LOC, 'x'),
      });
      const outerLookup = nodes.lookupVal(ZERO_LOC, { target: innerLookup, val: nodes.symbol(ZERO_LOC, 'y') });
      const { errors } = validateExpression(outerLookup);
      expect(errors.some((e) => e.code === ExprErr.UNSAFE_PROPERTY)).toBe(true);
    });
  });

  describe('pipe expressions', () => {
    test('x | eval triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.pipe(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'eval'), args: [
        nodes.symbol(ZERO_LOC, 'x'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('eval');
    });

    test('x | Function triggers UNSAFE_PROPERTY', () => {
      const ast = nodes.pipe(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'Function'), args: [
        nodes.symbol(ZERO_LOC, 'x'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
      expect(errors[0]!.message).toContain('Function');
    });

    test('safe pipe passes', () => {
      const ast = nodes.pipe(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'upper'), args: [
        nodes.symbol(ZERO_LOC, 'text'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });

    test('pipe with multiple args passes for safe function', () => {
      const ast = nodes.pipe(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'replace'), args: [
        nodes.symbol(ZERO_LOC, 'text'),
        nodes.literal(ZERO_LOC, 'old'),
        nodes.literal(ZERO_LOC, 'new'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });

    test('pipe with dangerous argument', () => {
      const ast = nodes.pipe(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'upper'), args: [
        nodes.symbol(ZERO_LOC, '__proto__'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors.some((e) => e.code === ExprErr.UNSAFE_PROPERTY)).toBe(true);
    });
  });

  describe('error location', () => {
    test('error includes lineno and colno', () => {
      const ast = nodes.symbol(loc({ lineno: 5, colno: 10 }), '__proto__');
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.lineno).toBe(5);
      expect(errors[0]!.colno).toBe(10);
    });

    test('error path includes context for nested lookups', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(loc({ lineno: 1, colno: 2 }), 'obj'),
        val: nodes.symbol(loc({ lineno: 3, colno: 4 }), '__proto__'),
      });
      const { errors } = validateExpression(ast);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.path).toBeDefined();
    });
  });

  describe('configuration overrides', () => {
    test('empty config uses default security config', () => {
      const ast = nodes.symbol(ZERO_LOC, '__proto__');
      const { errors: errorsWithDefault } = validateExpression(ast);
      const { errors: errorsWithEmpty } = validateExpression(ast, {});
      expect(errorsWithDefault).toHaveLength(errorsWithEmpty.length);
    });

    test('blockedPropertyPatterns can be overridden to empty on lookupVal', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.literal(ZERO_LOC, '__secret__'),
      });
      const { errors } = validateExpression(ast, { blockedPropertyPatterns: [] });
      expect(errors).toHaveLength(0);
    });

    test('custom blockedPropertyPatterns can be more restrictive', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.literal(ZERO_LOC, 'abc'),
      });
      const { errors } = validateExpression(ast, { blockedPropertyPatterns: [/^abc/] });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.code).toBe(ExprErr.UNSAFE_PROPERTY);
    });

    test('allowDynamicPropertyAccess: true allows dynamic access', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, 'obj'),
        val: nodes.symbol(ZERO_LOC, 'anyProp'),
      });
      const { errors } = validateExpression(ast, { allowDynamicPropertyAccess: true });
      expect(errors).toHaveLength(0);
    });
  });

  describe('combined threats', () => {
    test('multiple dangerous accesses in one expression', () => {
      const ast = nodes.lookupVal(ZERO_LOC, {
        target: nodes.symbol(ZERO_LOC, '__proto__'),
        val: nodes.symbol(ZERO_LOC, 'constructor'),
      });
      const { errors } = validateExpression(ast);
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    test('dangerous call with dangerous argument', () => {
      const ast = nodes.funCall(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'eval'), args: [
        nodes.symbol(ZERO_LOC, '__proto__'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors.some((e) => e.code === ExprErr.UNSAFE_PROPERTY)).toBe(true);
    });

    test('safe expression with dangerous call', () => {
      const ast = nodes.funCall(ZERO_LOC, { name: nodes.symbol(ZERO_LOC, 'greet'), args: [
        nodes.symbol(ZERO_LOC, 'name'),
      ] });
      const { errors } = validateExpression(ast);
      expect(errors).toHaveLength(0);
    });
  });
});
