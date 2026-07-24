export { createFrame, lookup, set, type Frame } from './frame.ts';
export { createContext, isContext, type Context } from './context.ts';
export {
  createSafeString,
  isSafeString,
  copySafeness,
  markSafe,
  type SafeString,
} from './safe-string.ts';
export {
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  withKwargs,
} from './macro.ts';
export {
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  isNullAccessResult,
  isPropertyNotFoundResult,
  getNullParentName,
  getAccessPath,
  type NullAccessResult,
  type PropertyNotFoundResult,
  type AccessResult,
} from './member-access.ts';
export {
  createSandboxedObject,
  createSandboxedContext,
  wrapMemberAccess,
  wrapFunctionWithBlocking,
  resolveSandboxOptions,
  isAllowedKey,
  isBlockedKey,
  isDangerousGlobal,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
  type SandboxOptions,
  type ResolvedSandboxOptions,
} from './sandbox.ts';
export {
  createRenderContext,
  ctx,
  withDefaults,
  withComputed,
  withValidation,
  traceContext,
  toContext,
  createIsolatedContext,
  createForkedContext,
  type RenderContext,
} from './render-context.ts';
export {
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  handleError,
  fromIterator,
  inOperator,
} from './helpers.ts';
export {
  HOOK_EVENTS,
  type HookEvent,
  createHookEmitter,
  hookable,
} from './hooks.ts';
export {
  UNDEFINED_MODES,
  DEFAULT_UNDEFINED_MODE,
  getUndefinedMode,
  isValidUndefinedMode,
  type UndefinedMode,
} from './undefined.ts';
export {
  validateContext,
  findDangerousValues,
  scanTemplateForDangerousCode,
  scrubDangerousReferences,
  createSecurityValidator,
  validateContextKeys,
  isDangerousReference,
  restrictGlobals,
  type SecurityError,
  type DangerousCodeViolation,
  type ValidateContextOptions,
  type SecurityValidator,
} from './security.ts';
export {
  withTimeout,
  type TimeoutError,
  isTimeoutError,
} from './timeout.ts';
export {
  createWhitelistValidator,
  scanASTForTags,
  validateTemplateWhitelist,
  type WhitelistError,
  type WhitelistValidatorOptions,
  type WhitelistValidator,
  type TemplateWhitelistViolation,
  type TemplateWhitelistResult,
} from './whitelist.ts';
