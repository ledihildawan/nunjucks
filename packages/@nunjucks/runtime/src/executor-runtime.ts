import { createLog } from '@nunjucks/log';
import { getError } from '@nunjucks/log';
import { extractBlocks, isCompiledTemplateExports, BLOCK_META_KEY, type Environment, type CompiledRenderSignature } from '@nunjucks/shared';
import { wrapMemberAccess } from './sandbox/index.ts';
import { isNullAccessResult, isPropertyNotFoundResult } from './member-access.ts';
import type { SandboxOptions } from './sandbox/index.ts';
import type { BlockLocation } from './context.ts';
import type { RenderRuntime } from './render-runtime.ts';

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
    if (!isCompiledTemplateExports(renderFn)) {
      throw createLog('error', getError('INVALID_CODE_FORMAT'), {}, null, { phase: 'compile' });
    }
    const blocks = extractBlocks(renderFn);
    return { render: renderFn.root, blocks, blockMeta: (renderFn[BLOCK_META_KEY] as Record<string, BlockLocation>) || {} };
  }

  throw createLog('error', getError('INVALID_CODE_FORMAT'), {}, null, { phase: 'compile' });
};

const buildSandboxOptions = (config: { sandboxAllowlist?: readonly string[]; sandboxMode?: string; sandboxEnvironment?: Environment }): SandboxOptions => ({
  allowlist: config.sandboxAllowlist || [],
  blocklistMode: config.sandboxMode !== 'allowlist',
  environment: config.sandboxEnvironment || 'auto',
});

const toOptionalResult = (result: unknown): unknown => {
  if (isNullAccessResult(result) || isPropertyNotFoundResult(result)) { return undefined; }
  return result;
};

const buildSandboxedRuntime = (runtime: RenderRuntime, sandboxOptions: SandboxOptions): RenderRuntime => ({
  ...runtime,
  memberLookup: (obj: unknown, value: string | symbol, parentName: string | null = null) => wrapMemberAccess(obj, value, true, sandboxOptions, parentName),
  optionalMemberLookup: (obj: unknown, value: string | symbol, parentName: string | null = null) => toOptionalResult(wrapMemberAccess(obj, value, true, sandboxOptions, parentName)),
});

export { getRenderFunction, buildSandboxOptions, buildSandboxedRuntime };
export type { RenderFunctionResult, SandboxOptions, Environment };
