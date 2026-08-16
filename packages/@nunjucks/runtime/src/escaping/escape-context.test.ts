import { describe, expect, test } from 'bun:test';
import {
  createHtmlContextTracker,
  escapeAttribute,
  escapeForContext,
  escapeScriptString,
  escapeStyle,
} from './escape-context.ts';

describe('escapeForContext', () => {
  test('html context escapes & < > " \' \\', () => {
    expect(escapeForContext('a & <b> "c" \'d\' \\e', 'html')).toBe(
      'a &amp; &lt;b&gt; &quot;c&quot; &#39;d&#39; &#92;e'
    );
  });

  test('attribute context escapes backtick too', () => {
    expect(escapeForContext('a `b` "c"', 'attribute')).toBe('a &#96;b&#96; &quot;c&quot;');
  });

  test('script context escapes < > and quotes (per-char)', () => {
    expect(escapeForContext('</script>', 'script')).toBe('\\u003c/script\\u003e');
    expect(escapeForContext('a"b\'c', 'script')).toBe('a\\"b\\\'c');
  });

  test('style context escapes html metacharacters', () => {
    expect(escapeForContext('a <b> "c"', 'style')).toBe('a &lt;b&gt; &quot;c&quot;');
  });

  test('comment context neutralizes -->', () => {
    expect(escapeForContext('a --> b', 'comment')).toBe('a --&gt; b');
  });

  test('unquoted-attribute context percent-encodes delimiters (XSS breakout guard)', () => {
    expect(escapeForContext('x onmouseover=alert(1)', 'unquoted-attribute')).toBe(
      'x%20onmouseover%3Dalert(1)'
    );
    expect(escapeForContext('a=b c', 'unquoted-attribute')).toBe('a%3Db%20c');
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
    const src = '<a href="x" V>';
    const tracker = createHtmlContextTracker(src);
    expect(tracker.getContextAt(src.indexOf('V'))).toBe('attribute');
  });

  test('detects unquoted-attribute context for a bare-equals interpolation', () => {
    // WHY: mirrors compiler reality — getHtmlContext is queried at the expression node's
    // position, so the scanned prefix ends inside the {{ delimiters.
    const src = '<div class={{ USERVAL }}></div>';
    const tracker = createHtmlContextTracker(src);
    expect(tracker.getContextAt(src.indexOf('USERVAL'))).toBe('unquoted-attribute');
  });

  test('quoted attribute interpolations keep the quoted-attribute context', () => {
    const src = '<div class="{{ USERVAL }}"></div>';
    const tracker = createHtmlContextTracker(src);
    expect(tracker.getContextAt(src.indexOf('USERVAL'))).toBe('attribute');
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
