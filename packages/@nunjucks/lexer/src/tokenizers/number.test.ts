import { describe, test, expect } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeNumber } from './number.ts';

const run = (src: string) => tokenizeNumber({ ...createState(src), inCode: true });

describe('tokenizeNumber', () => {
  test('returns null for non-digit', () => {
    expect(run('abc')).toBeNull();
  });

  test('integer', () => {
    const r = run('42');
    expect(r?.token.type).toBe('int');
    expect(r?.token.value).toBe(42);
  });

  test('float', () => {
    const r = run('3.14');
    expect(r?.token.type).toBe('float');
    expect(r?.token.value).toBe(3.14);
  });

  test('1..2 only consumes the integer', () => {
    const r = run('1..2');
    expect(r?.token.type).toBe('int');
    expect(r?.token.value).toBe(1);
    expect(r?.state.index).toBe(1);
  });

  test('trailing dot 1. emits float', () => {
    const r = run('1.');
    expect(r?.token.type).toBe('float');
    expect(r?.token.value).toBe(1);
  });

  test('leading zero', () => {
    const r = run('007');
    expect(r?.token.value).toBe(7);
  });
});
