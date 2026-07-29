import {
  suppressValue, awaitValue, handleError, contextOrFrameLookup,
  memberLookup, optionalMemberLookup, slice, nullishCoalesce,
  inOperator, fromIterator, callWrap,
  ensureDefined, isSafeString, markSafe, copySafeness,
  lookup,
  createFrame,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  makeMacro,
  createSafeString,
  wrapMemberAccess,
  isNullAccessResult,
  isPropertyNotFoundResult,
  type Frame,
} from '@nunjucks/runtime';
import { createLog } from '@nunjucks/log';
import { getError } from '@nunjucks/log';
import { extractBlocks } from '@nunjucks/shared';

const ROOT_FUNCTION_RE = /^async\s+function\s+root\s*\(/;

interface RenderFunctionResult {
  render: (env: unknown, context: unknown, frame: Frame, runtime: unknown) => Promise<unknown>;
  blocks: Record<string, unknown>;
  blockMeta: Record<string, unknown>;
}

const getRenderFunction = (code: string): RenderFunctionResult => {
  const newFormatMatch = code.match(ROOT_FUNCTION_RE);
  if (newFormatMatch) {
    const codeWithReturn = `${code}; return root;`;
    const renderFn = new Function(codeWithReturn)();
    const result = renderFn as { root: RenderFunctionResult['render']; __blockMeta?: Record<string, unknown> };
    const blocks = extractBlocks(result);
    return { render: result.root, blocks, blockMeta: result.__blockMeta || {} };
  }

  throw createLog('error', getError('INVALID_CODE_FORMAT'), {}, null, { phase: 'compile' });
};

const getRuntimeHelpers = () => ({
  suppressValue,
  awaitValue,
  handleError,
  contextOrFrameLookup,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  inOperator,
  fromIterator,
  callWrap,
  ensureDefined,
  isSafeString,
  markSafe,
  copySafeness,
  lookup,
  createFrame,
  createSafeString,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  makeMacro,
  escape: (str: unknown, autoescape = true): string => {
    if (!autoescape) { return String(str); }
    if (str && typeof str === 'object' && isSafeString(str as { val?: unknown })) { return String((str as { val: unknown }).val); }
    if (Array.isArray(str)) { return str.join(','); }
    if (str && typeof str === 'object') { return JSON.stringify(str); }
    return String(str).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] as string));
  },
});

type Environment = 'auto' | 'node' | 'browser' | 'deno';

interface SandboxOptions {
  allowlist?: string[];
  blocklistMode?: boolean;
  environment?: Environment;
}

const buildSandboxOptions = (config: { sandboxAllowlist?: string[]; sandboxMode?: string; sandboxEnvironment?: string }): SandboxOptions => ({
  allowlist: config.sandboxAllowlist || [],
  blocklistMode: config.sandboxMode !== 'allowlist',
  environment: (config.sandboxEnvironment || 'auto') as Environment,
});

const toOptionalResult = (result: unknown): unknown => {
  if (isNullAccessResult(result) || isPropertyNotFoundResult(result)) { return undefined; }
  return result;
};

const buildSandboxedRuntime = (runtime: Record<string, unknown>, sandboxOptions: SandboxOptions): Record<string, unknown> => {
  runtime.memberLookup = (obj: unknown, val: string | symbol, parentName: string | null = null) => wrapMemberAccess(obj, val, true, sandboxOptions, parentName);
  runtime.optionalMemberLookup = (obj: unknown, val: string | symbol, parentName: string | null = null) => toOptionalResult(wrapMemberAccess(obj, val, true, sandboxOptions, parentName));
  return runtime;
};

export { getRenderFunction, getRuntimeHelpers, buildSandboxOptions, buildSandboxedRuntime };
export type { RenderFunctionResult, SandboxOptions, Environment };
