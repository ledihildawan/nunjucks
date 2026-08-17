/** Wraps terminal text in an OSC 8 hyperlink, styling `text` while opening `url`. */
export const createHyperlink = (text: string, url: string): string =>
  `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
