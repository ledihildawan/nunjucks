import { describe, expect, test } from 'bun:test';
import type { TemplateError } from '@nunjucks/error-formatter';
import { literal, output, templateData } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import {
  assertNodeType,
  compileNodeChildren,
  compileNodeExpression,
} from './compile-expression.ts';

const makeRecordingCompiler = () => {
  const calls: string[] = [];
  return {
    calls,
    assertType: () => {
      calls.push('assert');
    },
    compile: () => {
      calls.push('compile');
    },
  };
};

describe('assertNodeType', () => {
  test('accepts a node whose type matches a string matcher', () => {
    expect(() => assertNodeType(literal(ZERO_LOC, 'value'), 'literal')).not.toThrow();
  });

  test('accepts a node whose type matches a factory matcher by function name', () => {
    // WHY: node factories double as matchers — their function `.name` equals the node type string
    expect(() => assertNodeType(literal(ZERO_LOC, 'value'), literal)).not.toThrow();
  });

  test('rejects a statement node with the catalogued message', () => {
    const statementNode = output(ZERO_LOC, [templateData(ZERO_LOC, 'text')]);
    expect(() => assertNodeType(statementNode, 'literal')).toThrow(/Invalid type assertion/);
  });

  test('enriches the rejection with code and compile phase', () => {
    const statementNode = output(ZERO_LOC, [templateData(ZERO_LOC, 'text')]);
    let caughtError: unknown;
    try {
      assertNodeType(statementNode, 'literal');
    } catch (error: unknown) {
      caughtError = error;
    }
    const templateError = caughtError as TemplateError;
    expect(templateError.code).toBe('ASSERT_TYPE_ERROR');
    expect(templateError.phase).toBe('compile');
  });
});

describe('compileNodeExpression', () => {
  test('asserts the expression type before compiling', () => {
    const compiler = makeRecordingCompiler();
    compileNodeExpression(compiler, literal(ZERO_LOC, 'value'), createFrame());
    expect(compiler.calls).toEqual(['assert', 'compile']);
  });
});

describe('compileNodeChildren', () => {
  test('compiles each child in order', () => {
    const compiler = makeRecordingCompiler();
    const container = output(ZERO_LOC, [templateData(ZERO_LOC, 'a'), templateData(ZERO_LOC, 'b')]);
    compileNodeChildren(compiler, container, createFrame());
    expect(compiler.calls).toEqual(['compile', 'compile']);
  });

  test('is a no-op for children-less nodes', () => {
    const compiler = makeRecordingCompiler();
    compileNodeChildren(compiler, literal(ZERO_LOC, 'value'), createFrame());
    expect(compiler.calls).toEqual([]);
  });
});
