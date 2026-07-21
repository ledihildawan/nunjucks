import { describe, test, expect } from 'bun:test';
import { liftPipes } from './pipe.ts';
import { output, literal, symbol, keywordArgs, pipe, root } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';

describe('liftPipes', () => {
  test('returns ast unchanged when no async pipes', () => {
    const out = output(1, 0, [literal(1, 0, 42)]);
    const ast = root(1, 0, [out]);
    const result = liftPipes(ast, []);
    expect(result).toBe(ast);
  });

  test('lifts async pipe inside Output into PipeAsync with symbol', () => {
    const filterRef = symbol(1, 0, 'asyncFilter');
    const args = keywordArgs(1, 0);
    const pipeNode = pipe(1, 0, filterRef, args);
    const out = output(1, 0, [pipeNode]);
    const ast = root(1, 0, [out]);
    const result = liftPipes(ast, ['asyncFilter']);
    const wrapper = (result as unknown as { children: { children: unknown[] }[] }).children[0];
    expect(getNodeTypeName(wrapper.children[0])).toBe('pipeAsync');
    expect(getNodeTypeName(wrapper.children[1])).toBe('output');
  });

  test('lifts multiple async pipes', () => {
    const filterA = symbol(1, 0, 'filterA');
    const filterB = symbol(1, 0, 'filterB');
    const args = keywordArgs(1, 0);
    const pipeA = pipe(1, 0, filterA, args);
    const pipeB = pipe(1, 0, filterB, args);
    const out = output(1, 0, [pipeA, pipeB]);
    const ast = root(1, 0, [out]);
    const result = liftPipes(ast, ['filterA', 'filterB']);
    const wrapper = (result as unknown as { children: { children: unknown[] }[] }).children[0];
    expect(wrapper.children.length).toBe(3);
    expect(getNodeTypeName(wrapper.children[0])).toBe('pipeAsync');
    expect(getNodeTypeName(wrapper.children[1])).toBe('pipeAsync');
    expect(getNodeTypeName(wrapper.children[2])).toBe('output');
  });

  test('does not lift non-async pipes', () => {
    const filterRef = symbol(1, 0, 'safeFilter');
    const args = keywordArgs(1, 0);
    const pipeNode = pipe(1, 0, filterRef, args);
    const out = output(1, 0, [pipeNode]);
    const ast = root(1, 0, [out]);
    const result = liftPipes(ast, ['asyncFilter']);
    expect(result).toBe(ast);
  });

  test('creates PipeAsync with correct name and symbol', () => {
    const filterRef = symbol(1, 0, 'myFilter');
    const args = keywordArgs(1, 0);
    const pipeNode = pipe(1, 0, filterRef, args);
    const out = output(1, 0, [pipeNode]);
    const ast = root(1, 0, [out]);
    const result = liftPipes(ast, ['myFilter']);
    const wrapper = (result as unknown as { children: { children: unknown[] }[] }).children[0];
    const pipeAsyncNode = wrapper.children[0] as { name: { value: string } };
    expect(getNodeTypeName(pipeAsyncNode)).toBe('pipeAsync');
    expect(pipeAsyncNode.name.value).toBe('myFilter');
    expect(getNodeTypeName(pipeAsyncNode.name)).toBe('symbol');
  });
});
