// WHY: curated barrel — every public name is listed explicitly so a new module export
// cannot silently widen @nunjucks/lib's API surface; adding a name requires an edit here.

export { getAttrGetter } from './attribute-getter.ts';
export { collectStream, collectString } from './collect-stream.ts';
export { createSortComparator } from './compare.ts';
export {
  escapeAttribute,
  escapeHtml,
  escapeScriptString,
  escapeStyle,
  escapeUnquotedAttribute,
} from './escape.ts';
export type { HtmlContext } from './escape-context.ts';
export { createHtmlContextTracker, escapeForContext } from './escape-context.ts';
export { escapeRegex } from './escape-regex.ts';
export { fromIterator } from './from-iterator.ts';
export { createGensym } from './gensym.ts';
export { isDigit } from './is-digit.ts';
export { MATCH_ANY_RE } from './match-any-regex.ts';
export { normalize } from './normalize.ts';
export { basename } from './path-basename.ts';
export { replace, slice } from './pipe-helpers.ts';
export { readErrorCode } from './read-error-code.ts';
export type { Err, Ok, Result } from './result.ts';
export { err, getOrElse, isErr, isOk, ok } from './result.ts';
export {
  copySafeness,
  createSafeString,
  isSafeString,
  markSafe,
  type SafeString,
} from './safe-string.ts';
export { collectBackward, collectForward, normalizeIndex } from './slice.ts';
export { coalesceStream } from './stream-coalesce.ts';
export { titleCase } from './string-case.ts';
export {
  hasOwn,
  isArray,
  isFunction,
  isIterable,
  isKeyedObject,
  isNonNullish,
  isObject,
  isPlainObject,
  isResultLike,
  isString,
  isThenable,
  isTypedArray,
  readNumber,
  readObject,
  readString,
} from './type-guards.ts';
export { toWebReadableStream } from './web-readable-stream.ts';
