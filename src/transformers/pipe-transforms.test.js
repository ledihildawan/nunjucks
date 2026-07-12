import { describe, test, expect } from 'bun:test';
import { liftPipes } from './pipe-transforms.js';
import {
  NodeList, Root, Output, Pipe, PipeAsync, AstSymbol, Literal, FunCall, KeywordArgs,
  getNodeTypeName,
} from '../nodes/index.js';

describe('liftPipes', () => {
  test('returns ast unchanged when no async pipes', () => {
    const out = Output(1, 0, [Literal(1, 0, 42)]);
    const root = Root(1, 0, [out]);
    const result = liftPipes(root, []);
    expect(result).toBe(root);
  });

  test('lifts async pipe inside Output into PipeAsync with symbol', () => {
    const filterRef = AstSymbol(1, 0, 'asyncFilter');
    const args = KeywordArgs(1, 0);
    const pipe = Pipe(1, 0, filterRef, args);
    const out = Output(1, 0, [pipe]);
    const root = Root(1, 0, [out]);
    const result = liftPipes(root, ['asyncFilter']);
    const wrapper = result.children[0];
    expect(getNodeTypeName(wrapper.children[0])).toBe('PipeAsync');
    expect(getNodeTypeName(wrapper.children[1])).toBe('Output');
  });

  test('lifts multiple async pipes', () => {
    const filterA = AstSymbol(1, 0, 'filterA');
    const filterB = AstSymbol(1, 0, 'filterB');
    const args = KeywordArgs(1, 0);
    const pipeA = Pipe(1, 0, filterA, args);
    const pipeB = Pipe(1, 0, filterB, args);
    const out = Output(1, 0, [pipeA, pipeB]);
    const root = Root(1, 0, [out]);
    const result = liftPipes(root, ['filterA', 'filterB']);
    const wrapper = result.children[0];
    expect(wrapper.children.length).toBe(3);
    expect(getNodeTypeName(wrapper.children[0])).toBe('PipeAsync');
    expect(getNodeTypeName(wrapper.children[1])).toBe('PipeAsync');
    expect(getNodeTypeName(wrapper.children[2])).toBe('Output');
  });

  test('does not lift non-async pipes', () => {
    const filterRef = AstSymbol(1, 0, 'safeFilter');
    const args = KeywordArgs(1, 0);
    const pipe = Pipe(1, 0, filterRef, args);
    const out = Output(1, 0, [pipe]);
    const root = Root(1, 0, [out]);
    const result = liftPipes(root, ['asyncFilter']);
    expect(result).toBe(root);
  });

  test('creates PipeAsync with correct name and symbol', () => {
    const filterRef = AstSymbol(1, 0, 'myFilter');
    const args = KeywordArgs(1, 0);
    const pipe = Pipe(1, 0, filterRef, args);
    const out = Output(1, 0, [pipe]);
    const root = Root(1, 0, [out]);
    const result = liftPipes(root, ['myFilter']);
    const wrapper = result.children[0];
    const pipeAsync = wrapper.children[0];
    expect(getNodeTypeName(pipeAsync)).toBe('PipeAsync');
    expect(pipeAsync.name.value).toBe('myFilter');
    expect(getNodeTypeName(pipeAsync.name)).toBe('Symbol');
  });
});
