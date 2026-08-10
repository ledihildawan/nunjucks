export { parse, createParser } from './parse.ts';
export type { ParseOptions } from './parse.ts';
export type { ParserExtension, ParserContext } from './cursor.ts';
// WHY: extension-author cursor API — a custom-tag extension's `parse` callback receives the parserContext and
// needs these helpers to consume tokens (skip the tag name, advance past `%}`, etc.) the same way built-in
// tag parsers do. Exported so extensions can be authored against the public package surface.
export { skipSymbol, advanceAfterBlockEnd, consumeWhitespaceDrop, peekToken, nextToken, fail } from './cursor.ts';
export { EXPECTED_COLON_AFTER_DICT_KEY } from './parse.ts';