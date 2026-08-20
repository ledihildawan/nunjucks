import { describe, expect, test } from 'bun:test';
import { createHyperlink } from './hyperlink.ts';

describe('createHyperlink', () => {
  test('wraps text and url in a valid OSC 8 sequence', () => {
    expect(createHyperlink('app.njk', 'vscode://file/app.njk')).toBe(
      '\x1b]8;;vscode://file/app.njk\x1b\\app.njk\x1b]8;;\x1b\\'
    );
  });

  test('strips ESC/BEL from the URL so it cannot terminate or hijack the sequence', () => {
    // WHY: without its ESC the leftover ']8;;evil' text is inert — the OSC 8 body
    // carries no control characters, so the URL cannot close or forge a sequence.
    const out = createHyperlink('t', 'vscode://file/a\x1b]8;;evil.njk\x07');
    expect(out).toBe('\x1b]8;;vscode://file/a]8;;evil.njk\x1b\\t\x1b]8;;\x1b\\');
    const firstBody = out.slice(out.indexOf(']8;;') + 4, out.indexOf('\x1b\\'));
    const hasControls = [...firstBody].some((char) => {
      const code = char.codePointAt(0) ?? 0;
      return (
        code <= 0x08 ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        code === 0x7f ||
        (code >= 0x80 && code <= 0x9f)
      );
    });
    expect(hasControls).toBe(false);
  });

  test('strips BEL and 8-bit CSI from the link text', () => {
    expect(createHyperlink('a\x07b\x9bc', 'https://x.dev')).toBe(
      '\x1b]8;;https://x.dev\x1b\\abc\x1b]8;;\x1b\\'
    );
  });
});
