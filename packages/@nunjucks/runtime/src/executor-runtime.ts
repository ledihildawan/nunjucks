import { getError } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import {
  BLOCK_META_KEY,
  type CompiledRenderSignature,
  type Environment,
  extractBlocks,
  isCompiledTemplateExports,
  type SandboxMode,
} from '@nunjucks/shared';
import { loadCompiledCode } from './code-loader.ts';
import type { BlockLocation } from './context.ts';
import { isNullAccessResult, isPropertyNotFoundResult } from './member-access.ts';
import type { RenderRuntime } from './render-runtime.ts';
import type { SandboxOptions } from './sandbox/index.ts';
import { wrapMemberAccess } from './sandbox/index.ts';

const ROOT_FUNCTION_RE = /^async\s+function\*\s+root\s*\(/;

interface RenderFunctionResult {
  render: CompiledRenderSignature;
  blocks: Record<string, unknown>;
  blockMeta: Record<string, BlockLocation>;
}

const getRenderFunction = (code: string): RenderFunctionResult => {
  // WHY: both throws below signal INVALID_CODE_FORMAT — a compiler-output invariant (the compiler emitted malformed code), not a user-input failure, so they are not domain errors to convert to Result.
  const newFormatMatch = code.match(ROOT_FUNCTION_RE);
  if (newFormatMatch) {
    const codeWithReturn = `${code}; return root;`;
    const renderFn = loadCompiledCode(codeWithReturn);
    if (!isCompiledTemplateExports(renderFn)) {
      throw createLog('error', {
        def: getError('INVALID_CODE_FORMAT'),
        params: {},
        subject: null,
        context: { phase: 'compile' },
      });
    }
    const blocks = extractBlocks(renderFn);
    return {
      render: renderFn.root,
      blocks,
      // WHY: the compiled-exports contract (BLOCK_META_KEY) types the block-location table as
      // unknown; the compiler emits a Record<string, BlockLocation> or omits the key entirely,
      // so the narrowing cast restores that shape.
      blockMeta: (renderFn[BLOCK_META_KEY] as Record<string, BlockLocation>) ?? {},
    };
  }

  throw createLog('error', {
    def: getError('INVALID_CODE_FORMAT'),
    params: {},
    subject: null,
    context: { phase: 'compile' },
  });
};

const buildSandboxOptions = (config: {
  sandboxAllowlist?: readonly string[];
  sandboxMode?: SandboxMode;
  sandboxEnvironment?: Environment;
}): SandboxOptions => ({
  allowlist: config.sandboxAllowlist ?? [],
  blocklistMode: config.sandboxMode !== 'allowlist',
  environment: config.sandboxEnvironment ?? 'auto',
});

const toOptionalResult = (result: unknown): unknown => {
  if (isNullAccessResult(result) || isPropertyNotFoundResult(result)) {
    return undefined;
  }
  return result;
};

const buildSandboxedRuntime = (
  runtime: RenderRuntime,
  sandboxOptions: SandboxOptions
): RenderRuntime => ({
  ...runtime,
  memberLookup: (target: unknown, value: string | symbol, parentName: string | null = null) =>
    wrapMemberAccess({ target, value, sandboxEnabled: true, options: sandboxOptions, parentName }),
  optionalMemberLookup: (
    target: unknown,
    value: string | symbol,
    parentName: string | null = null
  ) =>
    toOptionalResult(
      wrapMemberAccess({ target, value, sandboxEnabled: true, options: sandboxOptions, parentName })
    ),
});

export type { Environment, RenderFunctionResult, SandboxOptions };
export { buildSandboxedRuntime, buildSandboxOptions, getRenderFunction };
