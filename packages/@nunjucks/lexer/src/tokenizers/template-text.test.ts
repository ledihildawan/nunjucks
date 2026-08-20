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

  test('keeps mid-line whitespace when the chunk starts mid-line', () => {
    // WHY: regression — `A{{ x }}   {% if %}` must keep the 3 spaces; the strip only
    // applies to runs that begin at column 0 of the line (original `colno <= tok.length`).
    const r = tokenizeTemplateText({ ...createState('   {% if %}'), colno: 9, lstripBlocks: true });
    expect(r?.token.type).toBe('data');
    expect(r?.token.value).toBe('   ');
  });

  test('strips when the chunk starts mid-line but a newline precedes the run', () => {
    // WHY: the run after the embedded newline does begin at column 0 of its line.
    const r = tokenizeTemplateText({
      ...createState('a\n  {% if %}'),
      colno: 9,
      lstripBlocks: true,
    });
    expect(r?.token.value).toBe('a\n');
  });

  test('strips line-leading non-breaking space like the original \\s class', () => {
    // WHY: the original engine tested the run against /^\s+$/, which matches \u00A0.
    const r = runLstrip('\u00A0\u00A0{% if %}');
    expect(r?.token.type).toBe('block-start');
    expect(r?.token.value).toBe('{%');
  });
});
