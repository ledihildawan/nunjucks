import { describe, test, expect } from 'bun:test';
import { liftPipes } from './pipe-transforms.js';
import { nodes } from '../nodes/index.js';

describe('liftPipes', () => {
  test('returns ast unchanged when no async pipes', () => {
    const out = nodes.output(1, 0, [nodes.literal(1, 0, 42)]);
    const root = nodes.root(1, 0, [out]);
    const result = liftPipes(root, []);
    expect(result).toBe(root);
  });

  test('lifts async pipe inside Output into PipeAsync with symbol', () => {
    const filterRef = nodes.symbol(1, 0, 'asyncFilter');
    const args = nodes.keywordArgs(1, 0);
    const pipe = nodes.pipe(1, 0, filterRef, args);
    const out = nodes.output(1, 0, [pipe]);
    const root = nodes.root(1, 0, [out]);
    const result = liftPipes(root, ['asyncFilter']);
    const wrapper = result.children[0];
    expect(nodes.getNodeTypeName(wrapper.children[0])).toBe('pipeAsync');
    expect(nodes.getNodeTypeName(wrapper.children[1])).toBe('output');
  });

  test('lifts multiple async pipes', () => {
    const filterA = nodes.symbol(1, 0, 'filterA');
    const filterB = nodes.symbol(1, 0, 'filterB');
    const args = nodes.keywordArgs(1, 0);
    const pipeA = nodes.pipe(1, 0, filterA, args);
    const pipeB = nodes.pipe(1, 0, filterB, args);
    const out = nodes.output(1, 0, [pipeA, pipeB]);
    const root = nodes.root(1, 0, [out]);
    const result = liftPipes(root, ['filterA', 'filterB']);
    const wrapper = result.children[0];
    expect(wrapper.children.length).toBe(3);
    expect(nodes.getNodeTypeName(wrapper.children[0])).toBe('pipeAsync');
    expect(nodes.getNodeTypeName(wrapper.children[1])).toBe('pipeAsync');
    expect(nodes.getNodeTypeName(wrapper.children[2])).toBe('output');
  });

  test('does not lift non-async pipes', () => {
    const filterRef = nodes.symbol(1, 0, 'safeFilter');
    const args = nodes.keywordArgs(1, 0);
    const pipe = nodes.pipe(1, 0, filterRef, args);
    const out = nodes.output(1, 0, [pipe]);
    const root = nodes.root(1, 0, [out]);
    const result = liftPipes(root, ['asyncFilter']);
    expect(result).toBe(root);
  });

  test('creates PipeAsync with correct name and symbol', () => {
    const filterRef = nodes.symbol(1, 0, 'myFilter');
    const args = nodes.keywordArgs(1, 0);
    const pipe = nodes.pipe(1, 0, filterRef, args);
    const out = nodes.output(1, 0, [pipe]);
    const root = nodes.root(1, 0, [out]);
    const result = liftPipes(root, ['myFilter']);
    const wrapper = result.children[0];
    const pipeAsync = wrapper.children[0];
    expect(nodes.getNodeTypeName(pipeAsync)).toBe('pipeAsync');
    expect(pipeAsync.name.value).toBe('myFilter');
    expect(nodes.getNodeTypeName(pipeAsync.name)).toBe('symbol');
  });
});
