export {
  isCodeExecutionPattern, getBlockedKeyCategory, isBlockedKey,
  isDangerousGlobal, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST,
  OBJECT_INTRINSICS, CODE_EXECUTION_KEYS,
  findDangerousValues,
  scanTemplateForDangerousCode,
  scrubDangerousReferences,
} from './security/index.ts';
export type { Environment, DangerousCodeViolation } from './security/index.ts';

export { resolveLocation } from './errors/index.ts';
export type { BaseValidationError } from './errors/index.ts';

export { escapeHtml, escapeForContext, createHtmlContextTracker } from './escaping/index.ts';
export type { HtmlContext } from './escaping/index.ts';

export { getCallerFile, getCallerLocation } from './caller-file.ts';
export type { CallerLocation } from './caller-file.ts';
export { MATCH_ANY_RE } from './constants.ts';
export { BLOCK_META_KEY, isCompiledTemplateExports } from './codegen-contract.ts';
export type { CompiledRenderSignature, CompiledTemplateExports } from './codegen-contract.ts';
export { extractBlocks } from './extract-blocks.ts';
export { replace, slice } from './pipe-helpers.ts';
export { RESERVED_KEYWORDS, validateFilterName, validateGlobalName, getReservedKeywords } from './reserved.ts';
export { hasOwn, isNonNullish, isFunction, isString, isArray, isPlainObject, isKeyedObject, isIterable, isThenable, readObject, readString, readNumber } from './type-guards.ts';
export type { NodeLocation, DomPurifyConfig } from './types.ts';
