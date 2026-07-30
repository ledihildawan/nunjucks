import { describe, expect, test } from 'bun:test';
import { escapeForContext, escapeAttribute, escapeScriptString, escapeStyle, createHtmlContextTracker } from './escape-context.ts';

describe('escapeForContext', () => {
  test('html context escapes & < > " \' \\', () => {
    expect(escapeForContext('a & <b> "c" \'d\' \\e', 'html')).toBe('a &amp; &lt;b&gt; &quot;c&quot; &#39;d&#39; &#92;e');
  });

  test('attribute context escapes backtick too', () => {
    expect(escapeForContext('a `b` "c"', 'attribute')).toBe('a &#96;b&#96; &quot;c&quot;');
  });

  test('script context escapes < > and quotes (per-char)', () => {
    // escapeWith is per-character, so < and > become \u003c/\u003e and the </
    // break-out is neutralised via the < escape.
    expect(escapeForContext('</script>', 'script')).toBe('\\u003c/script\\u003e');
    expect(escapeForContext('a"b\'c', 'script')).toBe('a\\"b\\\'c');
  });

  test('style context escapes html metacharacters', () => {
    expect(escapeForContext('a <b> "c"', 'style')).toBe('a &lt;b&gt; &quot;c&quot;');
  });

  test('comment context neutralizes -->', () => {
    expect(escapeForContext('a --> b', 'comment')).toBe('a --&gt; b');
  });
});

describe('individual escapers', () => {
  test('escapeAttribute', () => {
    expect(escapeAttribute('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;');
  });
  test('escapeScriptString escapes < and > to unicode escapes', () => {
    expect(escapeScriptString('</script>')).toBe('\\u003c/script\\u003e');
  });
  test('escapeStyle', () => {
    expect(escapeStyle('a < b')).toBe('a &lt; b');
  });
});

describe('createHtmlContextTracker', () => {
  test('detects script context inside <script>', () => {
    const src = '<div>x</div>\n<script>\nVALUE\n</script>';
    const tracker = createHtmlContextTracker(src);
    expect(tracker.getContextAtLineCol(2, 0)).toBe('script');
  });

  test('detects style context inside <style>', () => {
    const src = '<style>\nVALUE\n</style>';
    const tracker = createHtmlContextTracker(src);
    expect(tracker.getContextAtLineCol(1, 0)).toBe('style');
  });

  test('detects attribute context for a bare attribute name following a quoted value', () => {
    // The heuristic recognises an attribute context once a complete quoted
    // value precedes the cursor inside an open tag.
    const src = '<a href="x" V>';
    const tracker = createHtmlContextTracker(src);
    expect(tracker.getContextAt(src.indexOf('V'))).toBe('attribute');
  });

  test('defaults to html context outside tags', () => {
    const tracker = createHtmlContextTracker('<div>VALUE</div>');
    expect(tracker.getContextAt(0)).toBe('html');
  });

  test('getContextAt and getContextAtLineCol agree', () => {
    const src = '<script>VALUE</script>';
    const tracker = createHtmlContextTracker(src);
    const offset = src.indexOf('VALUE');
    expect(tracker.getContextAt(offset)).toBe(tracker.getContextAtLineCol(0, offset));
  });
});
