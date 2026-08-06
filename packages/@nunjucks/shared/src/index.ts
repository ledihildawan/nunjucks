// Cohesive domain clusters live in sub-folders (security/escaping/errors);
// general cross-cutting utilities stay at the root.

export {
  ENVIRONMENTS, isCodeExecutionPattern, getBlockedKeyCategory, isBlockedKey,
  isDangerousGlobal, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST,
  OBJECT_INTRINSICS, CODE_EXECUTION_KEYS,
  isDangerousReference, findDangerousValues,
  scanTemplateForDangerousCode,
} from './security/index.ts';
export type { Environment, ScanContext, DangerousCodeViolation } from './security/index.ts';

export { resolveLocation } from './errors/index.ts';
export type { LocationInputs, ResolvedLocation } from './errors/index.ts';

export { escapeHtml, escapeAttribute, escapeScriptString, escapeStyle, escapeForContext, createHtmlContextTracker } from './escaping/index.ts';
export type { HtmlContext, HtmlContextTracker } from './escaping/index.ts';

export { getCallerFile, getCallerLocation } from './caller-file.ts';
export type { CallerLocation } from './caller-file.ts';
export { MATCH_ANY_RE } from './constants.ts';
export { BLOCK_META_KEY } from './codegen-contract.ts';
export type { CompiledRenderSignature, CompiledTemplateExports } from './codegen-contract.ts';
export { extractBlocks } from './extract-blocks.ts';
export { replace, slice } from './pipe-helpers.ts';
export { RESERVED_KEYWORDS, validateFilterName, validateGlobalName, getReservedKeywords } from './reserved.ts';
export { hasOwn, isNonNullish, isFunction, isString, isArray, isPlainObject, isObject, isRecord, isKeyedObject, isIterable, isThenable, isArrayOf, readObject, readString, readNumber, readWith } from './type-guards.ts';
export type { NodeLocation, DomPurifyConfig } from './types.ts';
