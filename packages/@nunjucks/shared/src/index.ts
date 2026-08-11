export {
  isCodeExecutionPattern, getBlockedKeyCategory, isBlockedKey,
  isDangerousGlobal, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST,
  OBJECT_INTRINSICS, CODE_EXECUTION_KEYS,
  findDangerousValues,
  scanTemplateForDangerousCode,
  scrubDangerousReferences,
  visitAndScrub,
  containsNullByte,
  isWithinBase,
  ExpressionSecurityError, DEFAULT_SECURITY_CONFIG, type ExpressionSecurityConfig, DANGEROUS_PROPERTIES, DANGEROUS_CALLEES,
  type DangerousCodeViolation, type Environment,
} from '@nunjucks/validators/security';
export type { BaseValidationError } from './errors/index.ts';
export { normalizeLineBase } from './errors/index.ts';
export { TEMPLATE_ERROR, isTemplateError } from '@nunjucks/error-catalog';
export type { BrandedTemplateError } from '@nunjucks/error-catalog';
export type { LineBase } from '@nunjucks/error-catalog';
export { escapeHtml, escapeForContext, createHtmlContextTracker, type HtmlContext } from '@nunjucks/runtime/escaping';
export { BLOCK_META_KEY, isCompiledTemplateExports, extractBlocks } from '@nunjucks/compiler';
export type { CompiledRenderSignature, CompiledBlockSignature, CompiledTemplateExports } from '@nunjucks/compiler';
export { lineDistance, positionAtOffset, findAllOccurrences } from '@nunjucks/compiler';
export { loc, ZERO_LOC } from '@nunjucks/lexer';
export type { Loc } from '@nunjucks/lexer';
export { MATCH_ANY_RE } from '@nunjucks/lib';
export { escapeRegex, replace, slice, ok, err, isOk, isErr, map, flatMap, mapErr, getOrElse, fromThrowable } from '@nunjucks/lib';
export type { Ok, Err, Result } from '@nunjucks/lib';
export { hasOwn, isNonNullish, isFunction, isString, isArray, isPlainObject, isKeyedObject, isIterable, isThenable, readObject, readString, readNumber } from '@nunjucks/lib';
export type { Phase, NodeLocation, DomPurifyConfig } from './types.ts';
export { UNDEFINED_MODES, type UndefinedMode } from '@nunjucks/runtime';
