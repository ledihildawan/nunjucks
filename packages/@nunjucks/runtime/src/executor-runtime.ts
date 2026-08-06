import { createLog } from '@nunjucks/log';
import { getError } from '@nunjucks/log';
import { extractBlocks, BLOCK_META_KEY, type Environment, type CompiledTemplateExports, type CompiledRenderSignature } from '@nunjucks/shared';
import { wrapMemberAccess } from './sandbox/index.ts';
import { isNullAccessResult, isPropertyNotFoundResult } from './member-access.ts';
import type { SandboxOptions } from './sandbox/index.ts';
import type { BlockLocation } from './context.ts';

const ROOT_FUNCTION_RE = /^async\s+function\s+root\s*\(/;

interface RenderFunctionResult {
  render: CompiledRenderSignature;
  blocks: Record<string, unknown>;
  blockMeta: Record<string, BlockLocation>;
}

const getRenderFunction = (code: string): RenderFunctionResult => {
  const newFormatMatch = code.match(ROOT_FUNCTION_RE);
  if (newFormatMatch) {
    const codeWithReturn = `${code}; return root;`;
    const renderFn = new Function(codeWithReturn)();
    const result = renderFn as CompiledTemplateExports;
    const blocks = extractBlocks(result);
    return { render: result.root as RenderFunctionResult['render'], blocks, blockMeta: (result[BLOCK_META_KEY] as Record<string, BlockLocation>) || {} };
  }

  throw createLog('error', getError('INVALID_CODE_FORMAT'), {}, null, { phase: 'compile' });
};

const buildSandboxOptions = (config: { sandboxAllowlist?: string[]; sandboxMode?: string; sandboxEnvironment?: string }): SandboxOptions => ({
  allowlist: config.sandboxAllowlist || [],
  blocklistMode: config.sandboxMode !== 'allowlist',
  environment: (config.sandboxEnvironment || 'auto') as Environment,
});

const toOptionalResult = (result: unknown): unknown => {
  if (isNullAccessResult(result) || isPropertyNotFoundResult(result)) { return undefined; }
  return result;
};

const buildSandboxedRuntime = (runtime: Record<string, unknown>, sandboxOptions: SandboxOptions): Record<string, unknown> => ({
  ...runtime,
  memberLookup: (obj: unknown, val: string | symbol, parentName: string | null = null) => wrapMemberAccess(obj, val, true, sandboxOptions, parentName),
  optionalMemberLookup: (obj: unknown, val: string | symbol, parentName: string | null = null) => toOptionalResult(wrapMemberAccess(obj, val, true, sandboxOptions, parentName)),
});

export { getRenderFunction, buildSandboxOptions, buildSandboxedRuntime };
export type { RenderFunctionResult, SandboxOptions, Environment };
