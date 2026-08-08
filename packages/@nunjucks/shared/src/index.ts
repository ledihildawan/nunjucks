export {
  isCodeExecutionPattern, getBlockedKeyCategory, isBlockedKey,
  isDangerousGlobal, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST,
  OBJECT_INTRINSICS, CODE_EXECUTION_KEYS,
  findDangerousValues,
  scanTemplateForDangerousCode,
  scrubDangerousReferences,
} from './security/index.ts';
export type { Environment, DangerousCodeViolation } from './security/index.ts';

export type { BaseValidationError } from './errors/index.ts';

export { escapeHtml, escapeForContext, createHtmlContextTracker } from './escaping/index.ts';
export type { HtmlContext } from './escaping/index.ts';

export { MATCH_ANY_RE } from './constants.ts';
export { BLOCK_META_KEY, isCompiledTemplateExports } from './codegen-contract.ts';
export type { CompiledRenderSignature, CompiledTemplateExports } from './codegen-contract.ts';
export { extractBlocks } from './extract-blocks.ts';
export { escapeRegex } from './escape-regex.ts';
export { replace, slice } from './pipe-helpers.ts';
export { RESERVED_KEYWORDS, validateFilterName, validateGlobalName, getReservedKeywords } from './reserved.ts';
export { hasOwn, isNonNullish, isFunction, isString, isArray, isPlainObject, isKeyedObject, isIterable, isThenable, readObject, readString, readNumber } from './type-guards.ts';
export type { NodeLocation, DomPurifyConfig } from './types.ts';
export { loc, ZERO_LOC } from './loc.ts';
export type { Loc } from './loc.ts';
export { ok, err, isOk, isErr, map, flatMap, mapErr, getOrElse, fromThrowable } from './result.ts';
export type { Ok, Err, Result } from './result.ts';
