import { describe, expect, test } from 'bun:test';
import { displayWidth } from './display-width.ts';

describe('displayWidth', () => {
  test('ASCII counts one cell per character', () => {
    expect(displayWidth('')).toBe(0);
    expect(displayWidth('hello {{ user.name }}')).toBe(21);
  });

  test('CJK, Hangul, kana, and fullwidth glyphs occupy two cells', () => {
    expect(displayWidth('エラー位置')).toBe(10);
    expect(displayWidth('漢字')).toBe(4);
    expect(displayWidth('한국어')).toBe(6);
    expect(displayWidth('ｆｕｌｌ')).toBe(8);
    expect(displayWidth('、')).toBe(2);
    expect(displayWidth('\u{20000}')).toBe(2);
  });

  test('combining marks contribute zero cells', () => {
    expect(displayWidth('e\u0301')).toBe(1);
    expect(displayWidth('a\u0301\u0302')).toBe(1);
    expect(displayWidth('\u0301')).toBe(0);
  });

  test('astral pairs count as one unit — two cells on emoji planes, else one', () => {
    expect(displayWidth('\u{1F600}')).toBe(2);
    expect(displayWidth('x\u{1F600}x')).toBe(4);
    expect(displayWidth('\u{1D400}')).toBe(1);
  });

  test('control characters contribute zero cells', () => {
    expect(displayWidth('\u0000\u001f\u007f\u009f')).toBe(0);
    expect(displayWidth('a\u0007b')).toBe(2);
  });
});
