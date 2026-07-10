import { describe, test, expect } from 'bun:test';
import { liftPipes } from './pipe-transforms.js';
import {
  NodeList, Root, Output, Pipe, PipeAsync, AstSymbol, Literal, FunCall, KeywordArgs,
} from '../nodes/index.js';

describe('liftPipes', () => {
  test('returns ast unchanged when no async pipes', () => {
    const out = new Output(1, 0, [new Literal(1, 0, 42)]);
    const root = new Root(1, 0, [out]);
    const result = liftPipes(root, []);
    expect(result).toBe(root);
  });

  test('lifts async pipe inside Output into PipeAsync with symbol', () => {
    const filterRef = new AstSymbol(1, 0, 'asyncFilter');
    const args = new KeywordArgs(1, 0);
    const pipe = new Pipe(1, 0, filterRef, args);
    const out = new Output(1, 0, [pipe]);
    const root = new Root(1, 0, [out]);
    const result = liftPipes(root, ['asyncFilter']);
    const wrapper = result.children[0];
    expect(wrapper.children[0]).toBeInstanceOf(PipeAsync);
    expect(wrapper.children[1]).toBeInstanceOf(Output);
  });

  test('lifts multiple async pipes', () => {
    const filterA = new AstSymbol(1, 0, 'filterA');
    const filterB = new AstSymbol(1, 0, 'filterB');
    const args = new KeywordArgs(1, 0);
    const pipeA = new Pipe(1, 0, filterA, args);
    const pipeB = new Pipe(1, 0, filterB, args);
    const out = new Output(1, 0, [pipeA, pipeB]);
    const root = new Root(1, 0, [out]);
    const result = liftPipes(root, ['filterA', 'filterB']);
    const wrapper = result.children[0];
    expect(wrapper.children.length).toBe(3);
    expect(wrapper.children[0]).toBeInstanceOf(PipeAsync);
    expect(wrapper.children[1]).toBeInstanceOf(PipeAsync);
    expect(wrapper.children[2]).toBeInstanceOf(Output);
  });

  test('does not lift non-async pipes', () => {
    const filterRef = new AstSymbol(1, 0, 'safeFilter');
    const args = new KeywordArgs(1, 0);
    const pipe = new Pipe(1, 0, filterRef, args);
    const out = new Output(1, 0, [pipe]);
    const root = new Root(1, 0, [out]);
    const result = liftPipes(root, ['asyncFilter']);
    expect(result).toBe(root);
  });

  test('creates PipeAsync with correct name and symbol', () => {
    const filterRef = new AstSymbol(1, 0, 'myFilter');
    const args = new KeywordArgs(1, 0);
    const pipe = new Pipe(1, 0, filterRef, args);
    const out = new Output(1, 0, [pipe]);
    const root = new Root(1, 0, [out]);
    const result = liftPipes(root, ['myFilter']);
    const wrapper = result.children[0];
    const pipeAsync = wrapper.children[0];
    expect(pipeAsync).toBeInstanceOf(PipeAsync);
    expect(pipeAsync.name.value).toBe('myFilter');
    expect(pipeAsync.symbol).toBeInstanceOf(AstSymbol);
  });
});
