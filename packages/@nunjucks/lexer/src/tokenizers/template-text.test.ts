import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeTemplateText } from './template-text.ts';

const run = (src: string) => tokenizeTemplateText(createState(src));
const runLstrip = (src: string) =>
  tokenizeTemplateText({ ...createState(src), lstripBlocks: true });

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

describe('tokenizeTemplateText lstripBlocks', () => {
  test('strips whitespace-only last line before a block tag', () => {
    const r = runLstrip('div\n  {% if %}');
    expect(r?.token.value).toBe('div\n');
  });

  test('delegates to block-start when the whole chunk is stripped', () => {
    const r = runLstrip('   {% if %}');
    expect(r?.token.type).toBe('block-start');
    expect(r?.token.value).toBe('{%');
  });

  test('keeps whitespace when the last line has content', () => {
    const r = runLstrip('a {% if %}');
    expect(r?.token.value).toBe('a ');
  });

  test('does not strip before variable tags', () => {
    const r = runLstrip('div\n  {{ x }}');
    expect(r?.token.value).toBe('div\n  ');
  });

  test('does not strip a tag at column 0', () => {
    const r = runLstrip('{% if %}');
    expect(r?.token.type).toBe('block-start');
  });
});
