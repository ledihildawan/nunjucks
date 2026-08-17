import { getError } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import {
  type CompiledRenderSignature,
  type Environment,
  extractBlocks,
  isCompiledTemplateExports,
  type SandboxMode,
} from '@nunjucks/shared';
import { loadCompiledCode } from './code-loader.ts';
import { isNullAccessResult, isPropertyNotFoundResult } from './member-access.ts';
import type { RenderRuntime } from './render-runtime.ts';
import type { SandboxOptions } from './sandbox/index.ts';
import { wrapMemberAccess } from './sandbox/index.ts';

const ROOT_FUNCTION_RE = /^async\s+function\*\s+root\s*\(/;

/** A loaded compiled template's render entry point and its extracted blocks. */
interface RenderFunctionResult {
  render: CompiledRenderSignature;
  blocks: Record<string, unknown>;
}

/**
 * Loads and validates compiler output, returning the async-generator `root`
 * render function plus its blocks; anything that is not a well-formed compiled
 * exports object throws INVALID_CODE_FORMAT.
 */
const getRenderFunction = (code: string): RenderFunctionResult => {
  // WHY: both throws below signal INVALID_CODE_FORMAT — a compiler-output invariant (the compiler emitted malformed code), not a user-input failure, so they are not domain errors to convert to Result.
  if (ROOT_FUNCTION_RE.test(code)) {
    const renderFn = loadCompiledCode(code);
    if (!isCompiledTemplateExports(renderFn)) {
      throw createLog('error', {
        def: getError('INVALID_CODE_FORMAT'),
        params: {},
        subject: null,
        context: { phase: 'compile' },
      });
    }
    return {
      render: renderFn.root,
      blocks: extractBlocks(renderFn),
    };
  }

  throw createLog('error', {
    def: getError('INVALID_CODE_FORMAT'),
    params: {},
    subject: null,
    context: { phase: 'compile' },
  });
};

/** Resolves executor sandbox config into `SandboxOptions`, defaulting to blocklist mode. */
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

/**
 * Derives a runtime whose `memberLookup` and `optionalMemberLookup` route
 * through the sandbox wrapper, mapping miss sentinels back to `undefined` for
 * the optional form.
 */
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
