import { describe, test, expect } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeTemplateText } from './template-text.ts';

const run = (src: string) => tokenizeTemplateText(createState(src));

describe('tokenizeTemplateText', () => {
  test('returns null when inCode is true', () => {
    expect(tokenizeTemplateText({ ...createState('hello'), inCode: true })).toBeNull();
  });

  test('plain text', () => {
    const r = run('hello world');
    expect(r?.token.type).toBe('data');
    expect(r?.token.value).toBe('hello world');
  });

  test('stops at variable start', () => {
    const r = run('hi {{ x }}');
    expect(r?.token.value).toBe('hi ');
  });

  test('stops at block start', () => {
    const r = run('text {% if %}');
    expect(r?.token.value).toBe('text ');
  });

  test('stops at comment start', () => {
    const r = run('a {# b');
    expect(r?.token.value).toBe('a ');
  });

  test('returns null for empty string', () => {
    expect(run('')).toBeNull();
  });
});
