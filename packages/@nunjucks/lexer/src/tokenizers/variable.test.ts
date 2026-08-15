import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeVariableEnd, tokenizeVariableStart } from './variable.ts';

describe('tokenizeVariableStart', () => {
  test('plain {{', () => {
    const r = tokenizeVariableStart({ ...createState('{{'), inCode: false });
    expect(r?.token.type).toBe('variable-start');
  });

  test('strip {{-', () => {
    const r = tokenizeVariableStart({ ...createState('{{-'), inCode: false });
    expect(r?.token.stripLeft).toBe(true);
  });

  test('lone { does not match', () => {
    expect(tokenizeVariableStart({ ...createState('{x'), inCode: false })).toBeNull();
  });
});

describe('tokenizeVariableEnd', () => {
  test('plain }}', () => {
    const r = tokenizeVariableEnd({ ...createState('}}'), inCode: false });
    expect(r?.token.type).toBe('variable-end');
  });

  test('strip -}}', () => {
    const r = tokenizeVariableEnd({ ...createState('-}}'), inCode: false });
    expect(r?.token.stripRight).toBe(true);
  });
});
