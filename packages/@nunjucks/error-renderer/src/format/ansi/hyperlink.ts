import { sanitizeTerminalText } from './sanitize-helpers.ts';

/**
 * Wraps terminal text in an OSC 8 hyperlink, styling `text` while opening `url`.
 * Control characters are stripped from both so raw input cannot terminate the
 * escape sequence or smuggle a second one; the URL is otherwise kept intact.
 */
export const createHyperlink = (text: string, url: string): string =>
  `\x1b]8;;${sanitizeTerminalText(url)}\x1b\\${sanitizeTerminalText(text)}\x1b]8;;\x1b\\`;
