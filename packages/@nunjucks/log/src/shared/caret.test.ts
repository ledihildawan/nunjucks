import { describe, expect, test } from 'bun:test';
import { calculateCaretPosition } from './caret.ts';

describe('calculateCaretPosition', () => {
  test('highlights the dotted identifier segment at the error column', () => {
    const line = "    const html = await nunjucks('{{ product.name }}');";
    const col = line.indexOf('name') + 1;
    const caret = calculateCaretPosition(line, col);

    expect(caret).toEqual({
      wordStart: line.indexOf('name'),
      wordEnd: line.indexOf('name') + 'name'.length,
      highlightWord: 'name',
      carets: '^^^^'
    });
  });

  test('keeps highlighting the first segment when the error column is there', () => {
    const line = "    const html = await nunjucks('{{ product.name }}');";
    const col = line.indexOf('product') + 1;
    const caret = calculateCaretPosition(line, col);

    expect(caret).toEqual({
      wordStart: line.indexOf('product'),
      wordEnd: line.indexOf('product') + 'product'.length,
      highlightWord: 'product',
      carets: '^^^^^^^'
    });
  });

  test('highlights punctuation at the error column', () => {
    const line = '{{ [1, 2, 3 }}';
    const col = line.indexOf('}') + 1;
    const caret = calculateCaretPosition(line, col);

    expect(caret).toEqual({
      wordStart: line.indexOf('}'),
      wordEnd: line.indexOf('}') + 1,
      highlightWord: '}',
      carets: '^'
    });
  });

  test('highlights a full filename with hyphen and extension', () => {
    const line = '{% include "nonexistent-template.html" %}';
    const col = line.indexOf('nonexistent-template.html') + 1;
    const caret = calculateCaretPosition(line, col);

    expect(caret).toEqual({
      wordStart: line.indexOf('nonexistent-template.html'),
      wordEnd: line.indexOf('nonexistent-template.html') + 'nonexistent-template.html'.length,
      highlightWord: 'nonexistent-template.html',
      carets: '^^^^^^^^^^^^^^^^^^^^^^^^^'
    });
  });
});
